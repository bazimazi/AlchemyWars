import { applyRelease, validateRelease } from '../src/core/releases.js';
import type { ContentRelease } from '../src/core/releases.js';
import { recordBattleCodex } from '../src/core/codex.js';
import { ServiceError, requireThat } from './errors.js';
export { ServiceError } from './errors.js';
import { guildAction, guildContribution, guildView } from './guilds.js';
import { competitionConfig, COMPETITIVE_MODES } from '../src/core/competition.js';
import type { WorldData, User, Guild, BattleClaim, Session, WorldView, BattleRequest, SocialPayload, SocialResult, LiveConfig } from './types.js';
import type { BattleConfig } from '../src/types.js';
import { MUTATORS, DISCOVERY_REWARDS } from '../src/data/systems.js';
import { mergeModifiers } from '../src/core/modifiers.js';
import { analyticsReport, refreshAchievements } from '../src/core/meta.js';
import { normalizeSave } from '../src/core/save.js';
import { challengeConfig, settleChallengeBattle } from '../src/core/challenges.js';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Store } from './store.js';
import { createPlayer, encounterUnlocked, claimBattle, validateTeam } from '../src/core/progression.js';
import { executeCommand } from '../src/core/commands.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { runBattleConfig, completeRunBattle, rotation } from '../src/core/modes.js';
import { CONTENT_VERSION, REACTION_BY_ID, ENEMIES, REACTIONS } from '../src/data/content.js';
import { resolveExperiment } from '../src/core/reactions.js';
import { track } from '../src/core/meta.js';

const scrypt = promisify(scryptCallback);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const seed = () => randomBytes(4).readUInt32LE();
const cleanName = (value: unknown, max = 40) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const sessionUser = (db: WorldData, token: string | undefined, now = Date.now()) => {
  const session = token && db.sessions[hash(token)];
  return session && session.expires > now ? db.users.find(u => u.id === session.userId) : null;
};
const publicUser = (user: User) => ({ id: user.id, name: user.name, discoveries: user.player.discoveries.length, wins: user.player.wins, endlessBest: user.player.endlessBest, rating: user.season === rotation().season ? user.rating : 1000, guildId: user.guildId });

export async function createService(directory: string) {
  const store = await new Store(directory).open();
  for (const release of store.data.releases ?? []) applyRelease(release);
  for (const user of store.data.users) user.player = normalizeSave(user.player);
  function authenticated(db: WorldData, token: string | undefined) { const user = sessionUser(db, token); requireThat(user, 'Sign in to use the shared world.', 401); return user; }
  function snapshot(user: User) { return { account: publicUser(user), player: structuredClone(user.player) }; }
  function prune(db: WorldData) {
    const now = Date.now();
    for (const [id, session] of Object.entries(db.sessions)) if (session.expires <= now) delete db.sessions[id];
    for (const [id, battle] of Object.entries(db.battles)) if (battle.createdAt + 86400000 < now || battle.config.contentVersion !== CONTENT_VERSION) delete db.battles[id];
  }
  return {
    store,
    async register(name: unknown, password: unknown) {
      requireThat(typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_-]{2,23}$/.test(name), 'Use a name of 3–24 letters, numbers, underscores or hyphens.');
      requireThat(typeof password === 'string' && password.length >= 12 && password.length <= 128, 'Choose a password between 12 and 128 characters.');
      const salt = randomBytes(16).toString('hex');
      const passwordHash = (await scrypt(password, salt, 64) as Buffer).toString('hex');
      const token = randomBytes(32).toString('hex');
      return store.transaction(db => {
        requireThat(!db.users.some(u => u.name.toLowerCase() === name.toLowerCase()), 'That alchemist name is already in use.', 409);
        const user: User = { id: randomUUID(), name, salt, passwordHash, player: createPlayer(), createdAt: Date.now(), rating: 1000, season: rotation().season, friends: [], requests: [], guildId: null, pvpClaims: [], challengeClaims: [] };
        db.users.push(user); prune(db);
        db.sessions[hash(token)] = { userId: user.id, expires: Date.now() + 7 * 86400000 };
        return { token, ...snapshot(user) };
      });
    },
    async login(name: unknown, password: unknown) {
      requireThat(typeof name === 'string' && typeof password === 'string' && password.length <= 128, 'Invalid name or password.', 401);
      const user = store.data.users.find(u => u.name.toLowerCase() === name.toLowerCase());
      const candidate = await scrypt(password, user?.salt ?? 'invalid-user-salt', 64) as Buffer;
      requireThat(user && timingSafeEqual(candidate, Buffer.from(user.passwordHash, 'hex')), 'Invalid name or password.', 401);
      const token = randomBytes(32).toString('hex');
      return store.transaction(db => { prune(db); db.sessions[hash(token)] = { userId: user.id, expires: Date.now() + 7 * 86400000 }; const current = db.users.find(u => u.id === user.id)!; track(current.player, 'session_started'); return { token, ...snapshot(current) }; });
    },
    async logout(token?: string) { return store.transaction(db => { if (token) delete db.sessions[hash(token)]; return { ok: true }; }); },
    me(token?: string): Session { const user = sessionUser(store.data, token); return user ? snapshot(user) : { account: null }; },
    async command(token: string | undefined, command: string, payload?: unknown) {
      return store.transaction(db => {
        const user = authenticated(db, token);
        const active = Object.values(db.battles).some(b => b.userId === user.id && !b.claimed && b.kind === 'run');
        requireThat(!active || !['start-run', 'retire-run', 'run-team', 'run-reward', 'run-experiment', 'run-tactics', 'run-scenario'].includes(command), 'Finish the active run battle first.');
        const result = executeCommand(user.player, command, payload, { seed: seed() });
        return { result, ...snapshot(user) };
      });
    },
    async startBattle(token: string | undefined, { kind = 'campaign', encounterId = '', opponentId, draft }: BattleRequest = {}) {
      return store.transaction(db => {
        const user = authenticated(db, token); prune(db);
        requireThat(db.live.enabled, 'The shared world is under maintenance. New battles will return shortly.', 503);
        requireThat(validateTeam(user.player), 'Your formation is invalid.');
        const existing = Object.entries(db.battles).find(([, b]) => b.userId === user.id && !b.claimed);
        if (existing) return { battleId: existing[0], config: existing[1].config, kind: existing[1].kind };
        let config: BattleConfig;
        if (kind === 'campaign') {
          requireThat(encounterUnlocked(user.player, encounterId), 'This expedition is not unlocked.');
          config = makeBattleConfig(user.player, encounterId, seed());
        } else if (['daily', 'weekly', 'festival'].includes(kind)) config = challengeConfig(user.player, kind);
        else if (kind === 'run') config = runBattleConfig(user.player);
        else if (COMPETITIVE_MODES.includes(kind)) {
          const opponent = db.users.find(u => u.id === opponentId);
          requireThat(opponent && opponent.id !== user.id, 'Choose another alchemist.');
          const fixedSeed = parseInt(hash([user.id, opponent.id].sort().join(':') + ':' + rotation().week).slice(0, 8), 16);
          try { config = competitionConfig(createPlayer(), kind, draft ?? [], fixedSeed); } catch (error) { throw new ServiceError(error instanceof Error ? error.message : 'Invalid competition.'); }
        } else if (kind === 'pvp' || kind === 'guild-war' || kind === 'draft-pvp') {
          const opponent = db.users.find(u => u.id === opponentId);
          requireThat(opponent && opponent.id !== user.id, 'Choose another alchemist.');
          if (kind === 'guild-war') requireThat(user.guildId && opponent.guildId && user.guildId !== opponent.guildId, 'Choose an alchemist from a rival guild.');
          requireThat(validateTeam(opponent.player), 'This opponent has no valid formation.');
          config = { ...makeBattleConfig(user.player, 'whispering-grove', seed()), normalized: true, opponentTeam: structuredClone(opponent.player.team), encounter: { region: 'Arena', label: 'PvP', description: 'A normalized duel.', id: 'arena', name: 'Arena · ' + opponent.name, environment: 'neutral', tip: 'Account mastery, research, talents and evolution are normalized.', enemies: [], scale: 1, gold: 0, knowledge: 0, xp: 0 } };
          if (kind === 'draft-pvp') {
            const pool = rotation().draft;
            requireThat(Array.isArray(draft) && draft.length === 3 && new Set(draft).size === 3 && draft.every(id => pool.includes(id)), 'Draft three distinct elements from today’s pool.');
            const opposing = pool.filter(id => !draft.includes(id));
            config.team = createPlayer().team.map((s, i) => ({ ...s, elements: [draft[i % 3], draft[(i + 1) % 3]] }));
            config.opponentTeam = createPlayer().team.map((s, i) => ({ ...s, elements: [opposing[i % 3], opposing[(i + 1) % 3]] }));
            config.encounter!.name = 'Draft Arena · ' + opponent.name;
          }
          track(user.player, 'pvp_started', { opponent: opponent.id });
        } else if (kind === 'guild') {
          const guild = db.guilds.find(g => g.id === user.guildId), week = rotation().week;
          requireThat(guild, 'Join a guild first.');
          if (guild.raid.week !== week) guild.raid = { week, health: 100000, damage: {}, claims: [] };
          requireThat(user.raidClaimWeek !== week && !guild.raid.claims.includes(user.id), 'You have already challenged this week’s guild guardian.');
          const boss = ENEMIES.filter(e => e.tags.includes('boss'))[week % 5];
          config = { ...makeBattleConfig(user.player, 'whispering-grove', seed()), encounter: { region: 'Guild', label: 'Raid', description: 'A shared guardian.', id: 'guild-raid', name: 'Guild Guardian · ' + boss.name, environment: 'storm', tip: 'Every point of damage contributes to your guild’s shared goal.', enemies: [boss.id], scale: 4, gold: 0, knowledge: 0, xp: 0 } };
        } else throw new ServiceError('Unknown battle mode.');
        if (db.live.mutator && !COMPETITIVE_MODES.includes(kind) && kind !== 'pvp' && kind !== 'guild-war' && kind !== 'draft-pvp') config.modifiers = mergeModifiers(config.modifiers, MUTATORS.find(m => m.id === db.live.mutator)?.modifiers);
        const battleId = randomUUID();
        db.battles[battleId] = { userId: user.id, config, kind, opponentId: opponentId ?? null, guildId: user.guildId, createdAt: Date.now(), claimed: false };
        track(user.player, 'battle_started', { kind, seed: config.seed });
        return { battleId, config, kind };
      });
    },
    async finishBattle(token: string | undefined, battleId: string) {
      return store.transaction(db => {
        const user = authenticated(db, token), pending = db.battles[battleId];
        requireThat(pending && pending.userId === user.id, 'Battle not found.', 404);
        if (pending.claimed) return { result: pending.result, ...snapshot(user) };
        requireThat(pending.config.contentVersion === CONTENT_VERSION, 'Battle content changed. Begin a new battle to use the current rules.', 409);
        // The client never submits damage, outcome, discoveries, currency, or a seed.
        const battle = simulateBattle(pending.config, { captureFrames: false });
        let result: BattleClaim = { outcome: battle.outcome, discoveries: [], duration: battle.duration };
        if (pending.kind === 'campaign') result = { ...result, ...claimBattle(user.player, battle, battleId) };
        if (['daily', 'weekly', 'festival'].includes(pending.kind)) result.claimed = settleChallengeBattle(user.player, battle, battleId, pending.createdAt);
        if (pending.kind === 'run') completeRunBattle(user.player, battle);
        if (pending.kind === 'guild-war') {
          const guild = db.guilds.find(g => g.id === pending.guildId), current = rotation();
          if (guild && user.guildId === guild.id) {
            if (guild.war?.week !== current.week) guild.war = { week: current.week, score: 0, claims: [] };
            const key = user.id + ':' + pending.opponentId;
            const accountKey = current.week + ':' + pending.opponentId;
            user.warClaims = (user.warClaims ?? []).filter(k => k.startsWith(current.week + ':'));
            if (!user.warClaims.includes(accountKey) && !guild.war.claims.includes(key)) { user.warClaims.push(accountKey); guild.war.claims.push(key); guild.war.score += battle.outcome === 'victory' ? 3 : battle.outcome === 'draw' ? 1 : 0; if (battle.outcome === 'victory') user.player.gold += 20; }
            result.guildScore = guild.war.score;
          }
        }
        if (pending.kind === 'pvp' || pending.kind === 'draft-pvp') {
          const current = rotation(), key = current.day + ':' + pending.opponentId;
          if (user.season !== current.season) { user.season = current.season; user.rating = 1000; user.pvpClaims = []; }
          if (!user.pvpClaims.includes(key)) {
            user.rating = Math.max(0, user.rating + (battle.outcome === 'victory' ? 20 : battle.outcome === 'draw' ? 0 : -10));
            user.pvpClaims.push(key);
            if (battle.outcome === 'victory') { user.player.gold += 25; user.player.knowledge += 3; }
          }
          track(user.player, 'pvp_finished', { outcome: battle.outcome, opponent: pending.opponentId });
        }
        if (pending.kind === 'guild') {
          const guild = db.guilds.find(g => g.id === pending.guildId);
          if (guild && user.guildId === guild.id && user.raidClaimWeek !== rotation().week && guild.raid.week === rotation().week && !guild.raid.claims.includes(user.id)) {
            user.raidClaimWeek = rotation().week;
            guild.raid.health = Math.max(0, guild.raid.health - battle.report.totalDamage);
            guild.raid.damage[user.id] = battle.report.totalDamage; guild.raid.claims.push(user.id);
            user.player.gold += 30; user.player.essence += 10;
            result.raidDamage = battle.report.totalDamage;
          }
        }
        if (COMPETITIVE_MODES.includes(pending.kind)) {
          const week = rotation(pending.createdAt).week;
          if (week === rotation().week) {
            if (user.competition?.week !== week) user.competition = { week, elementScore: 0, weeklyScore: 0, claims: [] };
            const key = pending.kind + ':' + pending.opponentId;
            if (!user.competition.claims.includes(key)) {
              user.competition.claims.push(key);
              const metric = pending.kind === 'element-wars' ? 'elementScore' : 'weeklyScore';
              user.competition[metric] += battle.outcome === 'victory' ? 3 : battle.outcome === 'draw' ? 1 : 0;
              if (battle.outcome === 'victory') user.player.gold += 15;
            }
          }
        }
        const memberGuild = db.guilds.find(g => g.id === pending.guildId && g.id === user.guildId);
        if (memberGuild && battle.outcome === 'victory' && rotation(pending.createdAt).week === rotation().week) guildContribution(memberGuild, user, 'battles');
        if (!['campaign', 'run', 'daily', 'weekly', 'festival'].includes(pending.kind)) recordBattleCodex(user.player, battle);
        refreshAchievements(user.player);
        user.player.lastReplay = structuredClone(pending.config);
        pending.claimed = true; pending.result = result;
        return { result, ...snapshot(user) };
      });
    },
    world(token?: string): WorldView {
      const user = authenticated(store.data, token), db = store.data;
      return { self: publicUser(user), players: db.users.map(publicUser).sort((a, b) => b.rating - a.rating).slice(0, 100), friends: user.friends, requests: user.requests, guilds: db.guilds.map(g => guildView(g, user)), standings: { elementWars: db.users.map(u => ({ id: u.id, name: u.name, score: u.competition?.week === rotation().week ? u.competition.elementScore : 0 })).sort((a,b) => b.score - a.score), weekly: db.users.map(u => ({ id: u.id, name: u.name, score: u.competition?.week === rotation().week ? u.competition.weeklyScore : 0 })).sort((a,b) => b.score - a.score) }, challenges: db.challenges.map(c => ({ id: c.id, name: c.name, author: db.users.find(u => u.id === c.author)?.name, allowed: c.allowed, targetName: REACTION_BY_ID[c.target].name, solved: user.challengeClaims.includes(c.id) })), shares: db.shares.slice(-30).reverse().map(s => ({ id: s.id, author: db.users.find(u => u.id === s.author)?.name, at: s.at })), live: db.live, rotation: rotation() };
    },
    async social(token: string | undefined, action: string, value: unknown = {}) {
      const payload = value as SocialPayload;
      return store.transaction(db => {
        const user = authenticated(db, token);
        let result: SocialResult = { ok: true };
        if (['guild-element-donate', 'guild-element-claim', 'guild-experiment', 'guild-mission'].includes(action)) {
          const guild = db.guilds.find(g => g.id === user.guildId); requireThat(guild, 'Join a guild first.');
          result = guildAction(guild, user, action, payload);
        } else if (action === 'friend-request') {
          const other = db.users.find(u => u.id === (payload.id ?? ''));
          requireThat(other && other.id !== user.id, 'Alchemist not found.');
          if (!other.requests.includes(user.id) && !other.friends.includes(user.id)) other.requests.push(user.id);
        } else if (action === 'friend-accept') {
          requireThat(user.requests.includes((payload.id ?? '')), 'No matching friend request.');
          const other = db.users.find(u => u.id === (payload.id ?? '')); requireThat(other, 'Alchemist not found.');
          user.requests = user.requests.filter(id => id !== other.id);
          if (!user.friends.includes(other.id)) user.friends.push(other.id);
          if (!other.friends.includes(user.id)) other.friends.push(user.id);
        } else if (action === 'guild-create') {
          const name = cleanName(payload.name); requireThat(name.length >= 3 && !user.guildId, 'Choose a guild name or leave your current guild.');
          requireThat(!db.guilds.some(g => g.name.toLowerCase() === name.toLowerCase()), 'That guild name is already taken.');
          const guild: Guild = { id: randomUUID(), name, owner: user.id, members: [user.id], knowledge: 0, research: 0, discoveries: [], donations: {}, rewardClaims: [], raid: { week: rotation().week, health: 100000, damage: {}, claims: [] } };
          db.guilds.push(guild); user.guildId = guild.id;
        } else if (action === 'guild-join') {
          const guild = db.guilds.find(g => g.id === (payload.id ?? '')); requireThat(guild && !user.guildId && guild.members.length < 50, 'This guild cannot be joined.');
          guild.members.push(user.id); user.guildId = guild.id;
        } else if (action === 'guild-leave') {
          const guild = db.guilds.find(g => g.id === user.guildId); requireThat(guild, 'You are not in a guild.');
          guild.members = guild.members.filter(id => id !== user.id); if (guild.owner === user.id) guild.owner = guild.members[0] ?? null; user.guildId = null;
        } else if (action === 'guild-donate') {
          const guild = db.guilds.find(g => g.id === user.guildId); requireThat(guild && user.player.knowledge >= 5, 'A donation requires a guild and 5 knowledge.');
          user.player.knowledge -= 5; guild.knowledge += 5; guild.donations[user.id] = (guild.donations[user.id] ?? 0) + 5;
          guild.research = Math.floor(guild.knowledge / 50);
        } else if (action === 'guild-discovery') {
          const guild = db.guilds.find(g => g.id === user.guildId);
          requireThat(guild && user.player.discoveries.includes((payload.id ?? '')), 'Choose a discovery you know.');
          if (!guild.discoveries.includes((payload.id ?? ''))) guild.discoveries.push((payload.id ?? ''));
        } else if (action === 'guild-reward') {
          const guild = db.guilds.find(g => g.id === user.guildId); requireThat(guild, 'Join a guild first.');
          const milestone = Math.floor(guild.discoveries.length / 5) + guild.research + (guild.raid.health === 0 ? 2 : 0);
          const key = user.id + ':' + milestone; requireThat(milestone > 0 && !guild.rewardClaims.includes(key), 'No unclaimed guild milestone.');
          guild.rewardClaims.push(key); user.player.essence += 10; user.player.shards += 2;
        } else if (action === 'share-discovery') {
          requireThat(user.player.discoveries.includes((payload.id ?? '')), 'Choose a discovery you know.');
          requireThat(!db.shares.some(s => s.author === user.id && s.reaction === (payload.id ?? '')), 'That discovery is already shared.');
          db.shares.push({ id: randomUUID(), author: user.id, reaction: (payload.id ?? ''), at: Date.now() }); db.shares = db.shares.slice(-500);
        } else if (action === 'reveal-share') {
          const share = db.shares.find(s => s.id === (payload.id ?? '')); requireThat(share, 'That shared discovery is unavailable.');
          result = { reaction: REACTION_BY_ID[share.reaction] };
        } else if (action === 'challenge-create') {
          const name = cleanName(payload.name), allowed = [...new Set(Array.isArray(payload.allowed) ? payload.allowed : [])];
          requireThat(name.length >= 3 && user.player.discoveries.includes((payload.target ?? '')) && allowed.length >= 2 && allowed.length <= 6 && allowed.every(id => user.player.owned.includes(id)), 'Use a name, a discovered target, and two to six owned starting elements.');
          requireThat(!db.challenges.some(c => c.author === user.id && c.name === name), 'You already created a challenge with that name.');
          let reachable = new Set(allowed), changed = true;
          while (changed) { changed = false; for (const r of REACTIONS) if (!r.conditions && r.inputs.every(id => reachable.has(id)) && !reachable.has(r.output)) { reachable.add(r.output); changed = true; } }
          const targetRule = REACTION_BY_ID[payload.target ?? ''];
          requireThat(targetRule && !targetRule.conditions && targetRule.inputs.every(id => reachable.has(id)) && !allowed.includes(targetRule.output), 'That target cannot be constructed from these starting elements.');
          requireThat(db.challenges.filter(c => c.author === user.id).length < 20, 'You can publish up to twenty challenges.');
          db.challenges.push({ id: randomUUID(), name, author: user.id, target: (payload.target ?? ''), allowed, at: Date.now() });
        } else if (action === 'challenge-solve') {
          const challenge = db.challenges.find(c => c.id === (payload.id ?? '')); requireThat(challenge, 'Challenge not found.');
          requireThat(Array.isArray(payload.steps) && payload.steps.length <= 12, 'Submit at most twelve experiment steps.');
          const available = new Set(challenge.allowed), performed = new Set<string>();
          for (const step of payload.steps) {
            requireThat(Array.isArray(step) && step.length === 2 && step.every(id => available.has(id)), 'The solution uses an unavailable element.');
            const rule = resolveExperiment(step[0], step[1]); requireThat(rule, 'A step has no stable reaction.'); available.add(rule.output); performed.add(rule.id);
          }
          requireThat(performed.has(challenge.target), 'The solution did not reach the target.');
          if (!user.challengeClaims.includes(challenge.id)) {
            user.challengeClaims.push(challenge.id); user.player.xp += DISCOVERY_REWARDS.challengeSolver.xp; user.player.knowledge += DISCOVERY_REWARDS.challengeSolver.knowledge;
            const author = db.users.find(u => u.id === challenge.author);
            if (author && author.id !== user.id) { author.player.xp += DISCOVERY_REWARDS.challengeCreatorXp; track(author.player, 'challenge_solved_by_player', { challenge: challenge.id }); }
          }
        } else throw new ServiceError('Unknown community action.');
        return { result, ...snapshot(user) };
      });
    },
    content() { return { version: CONTENT_VERSION, releases: structuredClone(store.data.releases ?? []) }; },
    async publishContent(value: unknown) {
      return store.transaction(db => {
        requireThat(!db.live.enabled, 'Enable maintenance before publishing a release.');
        prune(db);
        requireThat(!Object.values(db.battles).some(b => !b.claimed), 'Finish outstanding battles before publishing content.');
        const issues = validateRelease(value);
        requireThat(!issues.length, issues.join(' '));
        const release = structuredClone(value) as ContentRelease;
        requireThat(!(db.releases ?? []).some(r => r.pack.id === release.pack.id && r.pack.version >= release.pack.version), 'Increase the release version.');
        requireThat((db.releases?.length ?? 0) < 100, 'Archive releases into the next file distribution before publishing more.');
        db.releases = [...(db.releases ?? []), release];
        db.live.revision++;
        return release;
      }, release => applyRelease(release));
    },
    analytics() {
      const now = Date.now(), users = store.data.users;
      const active = (days: number) => users.filter(u => u.player.analytics.some(e => e.at > now - days * 86400000)).length;
      const reports = users.map(u => analyticsReport(u.player));
      const retention = Object.fromEntries([1, 7, 30].map(day => { const eligible = users.filter(u => now - u.createdAt >= day * 86400000); const returned = eligible.filter(u => u.player.activeDays.some(date => Math.floor(Date.parse(date) / 86400000) - Math.floor(u.createdAt / 86400000) === day)).length; return ['D' + day, { eligible: eligible.length, returned, rate: eligible.length ? returned / eligible.length : null }]; }));
      return { retention, approximateAverageSessionSeconds: reports.reduce((n, r) => n + r.averageSessionSeconds, 0) / Math.max(1, reports.length), campaignMilestones: Object.fromEntries([3, 15, 27, 39, 51, 63].map(n => [n, users.filter(u => u.player.campaign.length >= n).length])), accounts: users.length, activeDay: active(1), activeWeek: active(7), totalDiscoveries: users.reduce((n, u) => n + u.player.discoveries.length, 0), events: reports.reduce<Record<string, number>>((all, r) => { for (const [name, n] of Object.entries(r.counts)) all[name] = (all[name] ?? 0) + n; return all; }, {}), firstDiscoverySeconds: reports.map(r => r.firstDiscoverySeconds).filter(Number.isFinite) };
    },
    async updateLive(input: unknown) {
      const value = input as LiveConfig;
      requireThat(value && typeof value.enabled === 'boolean' && (!value.seasonName || typeof value.seasonName === 'string'), 'Invalid live configuration.');
      requireThat(!value.mutator || MUTATORS.some(m => m.id === value.mutator), 'Unknown live mutator.');
      return store.transaction(db => { db.live = { revision: db.live.revision + 1, enabled: value.enabled, mutator: value.mutator ?? null, seasonName: cleanName(value.seasonName ?? ''), announcements: Array.isArray(value.announcements) ? value.announcements.filter(a => typeof a === 'string').slice(0, 10).map(a => a.slice(0, 300)) : [] }; return db.live; });
    },
  };
}
