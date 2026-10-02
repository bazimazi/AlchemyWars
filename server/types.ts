import type { Player, BattleConfig, ReactionDefinition } from '../src/types.js';
import type { rotation } from '../src/core/modes.js';
export interface User { id: string; name: string; salt: string; passwordHash: string; player: Player; createdAt: number; rating: number; season: string; friends: string[]; requests: string[]; guildId: string | null; pvpClaims: string[]; challengeClaims: string[]; raidClaimWeek?: number; warClaims?: string[] }
export interface Guild { id: string; name: string; owner: string | null; members: string[]; knowledge: number; research: number; discoveries: string[]; donations: Record<string,number>; rewardClaims: string[]; raid: { week: number; health: number; damage: Record<string,number>; claims: string[] }; war?: { week: number; score: number; claims: string[] } }
export interface BattleClaim { outcome: string; discoveries: string[]; duration: number; claimed?: boolean; guildScore?: number; raidDamage?: number }
export interface PendingBattle { userId: string; config: BattleConfig; kind: string; opponentId: string | null; guildId: string | null; createdAt: number; claimed: boolean; result?: BattleClaim }
export interface LiveConfig { revision: number; enabled: boolean; seasonName: string | null; announcements: string[]; mutator?: string | null }
export interface WorldData { version: number; users: User[]; sessions: Record<string,{ userId: string; expires: number }>; battles: Record<string,PendingBattle>; guilds: Guild[]; challenges: { id: string; name: string; author: string; target: string; allowed: string[]; at: number }[]; shares: { id: string; author: string; reaction: string; at: number }[]; live: LiveConfig }
export type PublicUser = Pick<User, 'id' | 'name' | 'rating' | 'guildId'> & { discoveries: number; wins: number; endlessBest: number };
export interface Session { account: PublicUser | null; player?: Player }
export interface WorldView { self: PublicUser; players: PublicUser[]; friends: string[]; requests: string[]; guilds: Guild[]; challenges: { id: string; name: string; author?: string; allowed: string[]; targetName: string; solved: boolean }[]; shares: { id: string; author?: string; at: number }[]; live: LiveConfig; rotation: ReturnType<typeof rotation> }
export interface BattleRequest { kind?: string; encounterId?: string; opponentId?: string; draft?: string[] }
export interface SocialPayload { id?: string; name?: string; allowed?: string[]; target?: string; steps?: string[][] }
export interface SocialResult { ok?: boolean; reaction?: ReactionDefinition }
