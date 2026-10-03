import { abilitySlots, hasResearch } from '../core/research.js';
import type { Player } from '../types.js';
import { ABILITIES, VESSEL_PROFILES, vesselLevel } from '../data/units.js';
import { BALANCE, VESSEL_BY_ID } from '../data/content.js';
export function vesselStats(player: Player, id: string) {
  const definition = VESSEL_BY_ID[id], growth = VESSEL_PROFILES[id].growth, level = vesselLevel(player.vesselXp[id]) - 1;
  return { hp: Math.round((definition.hp + growth.hp * level) * BALANCE.healthMultiplier), attack: +(definition.attack + growth.attack * level).toFixed(2), armor: +(definition.armor + growth.armor * level).toFixed(2) };
}
export function renderUnitTools(player: Player, index: number) {
  const slot = player.team[index], growth = VESSEL_PROFILES[slot.vessel].growth;
  return `<p class="subtle">Vessel level ${vesselLevel(player.vesselXp[slot.vessel])} / 10 · ${player.vesselXp[slot.vessel] ?? 0} XP. Each level adds ${growth.hp * BALANCE.healthMultiplier} health, ${growth.attack} attack and ${growth.armor} armor. Campaign battles award 10 XP on victory, 3 otherwise.</p>` + Array.from({ length: abilitySlots(player.research) }, (_, rank) => rank).map(rank => `<label>Ability slot ${rank + 1}<select data-x-select="ability" data-rank="${rank}" data-index="${index}"><option value="">Elemental casts only</option>${ABILITIES.filter(a => a.discoveries <= player.discoveries.length && hasResearch(player.research, a.requiresResearch)).map(a => `<option value="${a.id}" ${slot.abilities?.[rank] === a.id ? 'selected' : ''} ${slot.abilities?.includes(a.id) && slot.abilities[rank] !== a.id ? 'disabled' : ''}>${a.name}</option>`).join('')}</select></label><p class="subtle">${ABILITIES.find(a => a.id === slot.abilities?.[rank])?.description ?? 'No ability assigned.'}</p>`).join('') + '<p class="subtle">Ready abilities take priority over elemental casts in slot order. Silence suppresses abilities. Competitive battles use the first two slots.</p>';
}
export function unitAnimation(id: string, casting: boolean, time = 0) {
  const animation = VESSEL_PROFILES[id]?.animation;
  if (!animation) return '';
  return ` data-motion="${casting ? 'cast' : animation.idle}" style="--idle-duration:${animation.duration}s;--idle-delay:${-time % animation.duration}s;--idle-lift:${animation.lift}px;--cast-reach:${animation.cast}px"`;
}
