import type { Guild, GuildView, User, SocialPayload, SocialResult } from './types.js';
import { REACTIONS, REACTION_BY_ID, ELEMENT_BY_ID } from '../src/data/content.js';
import { rotation } from '../src/core/modes.js';
import { resolveExperiment, pairKey } from '../src/core/reactions.js';
import { requireThat } from './errors.js';

export function guildWeek(guild: Guild, now = Date.now()) {
  const week = rotation(now).week;
  guild.elements ??= {};
  if (guild.activity?.week !== week) {
    const candidates = REACTIONS.filter(r => !r.conditions && r.inputs.every(id => ELEMENT_BY_ID[id].base));
    guild.activity = { week, donations: 0, experiments: 0, battles: 0, contributors: [], project: { target: candidates[week % candidates.length].id, progress: 0, goal: 20, contributors: {} } };
  }
  return guild.activity;
}
export function guildView(guild: Guild, user: User): GuildView {
  const copy = structuredClone(guild), activity = guildWeek(copy);
  const { target, ...project } = activity.project;
  const rule = REACTION_BY_ID[target];
  return { ...copy, activity: { ...activity, claimed: (user.guildClaims ?? []).filter(k => k.startsWith(activity.week + ':')), project: { ...project, hint: rule.hint, ...(project.progress >= project.goal ? { reaction: rule } : {}) } } };
}
export function guildContribution(guild: Guild, user: User, kind: 'donations' | 'experiments' | 'battles') {
  const activity = guildWeek(guild);
  activity[kind]++;
  if (!activity.contributors.includes(user.id)) activity.contributors.push(user.id);
}
export function guildAction(guild: Guild, user: User, action: string, payload: SocialPayload): SocialResult {
  const activity = guildWeek(guild), element = payload.id ?? '';
  user.guildClaims = (user.guildClaims ?? []).filter(k => k.startsWith(activity.week + ':'));
  user.guildActions = (user.guildActions ?? []).filter(k => k.startsWith(activity.week + ':'));
  if (action === 'guild-element-donate') {
    requireThat(user.player.owned.includes(element) && (user.player.mastery[element] ?? 0) >= 30, 'Donating an elemental imprint requires 30 mastery XP in an owned element.');
    user.player.mastery[element] -= 30;
    guild.elements![element] = (guild.elements![element] ?? 0) + 1;
    guildContribution(guild, user, 'donations');
  } else if (action === 'guild-element-claim') {
    requireThat(user.player.owned.includes(element) && (guild.elements![element] ?? 0) > 0, 'Choose a stored imprint of an element you own.');
    guild.elements![element]--;
    user.player.mastery[element] = (user.player.mastery[element] ?? 0) + 15;
  } else if (action === 'guild-experiment') {
    const a = payload.a ?? '', b = payload.b ?? '';
    requireThat(user.player.owned.includes(a) && user.player.owned.includes(b), 'Use two owned elements.');
    const rule = resolveExperiment(a, b);
    requireThat(rule, 'This pairing has no stable reaction. Try the laboratory first.');
    const key = activity.week + ':' + pairKey(a, b);
    requireThat(!user.guildActions.includes(key), 'You already contributed this pairing this week.');
    requireThat(activity.project.progress < activity.project.goal && user.player.knowledge >= 1, 'The project is complete or you need one knowledge.');
    user.player.knowledge--; user.guildActions.push(key);
    activity.project.progress++;
    activity.project.contributors[user.id] = (activity.project.contributors[user.id] ?? 0) + 1;
    guildContribution(guild, user, 'experiments');
  } else if (action === 'guild-mission') {
    const targets = { donations: 3, experiments: 10, battles: 1, project: 20 } as const;
    requireThat(Object.hasOwn(targets, element), 'Unknown guild mission.');
    const mission = element as keyof typeof targets, key = activity.week + ':' + mission;
    const progress = mission === 'project' ? activity.project.progress : activity[mission];
    requireThat(activity.contributors.includes(user.id) && progress >= targets[mission] && !user.guildClaims.includes(key), 'Contribute to a completed, unclaimed mission first.');
    user.guildClaims.push(key); user.player.gold += 30; user.player.knowledge += 5; user.player.essence += 10;
    if (mission === 'project') return { ok: true, reaction: REACTION_BY_ID[activity.project.target] };
  } else throw new Error('Unknown guild project action.');
  return { ok: true };
}
