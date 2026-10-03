import type { Player, Encounter } from '../types.js';
import { STORY_SCENES, STORY_CHARACTERS } from '../data/scenes.js';
import { ELEMENT_BY_ID } from '../data/content.js';
import { encounterUnlocked } from '../core/progression.js';
import { escapeHtml as esc } from './dom.js';
import { creature } from './art.js';

export function renderStoryScene(player: Player, encounter: Encounter, moment: 'before' | 'after') {
  const scene = STORY_SCENES.find(s => s.encounter === encounter.id);
  if (!scene || !encounterUnlocked(player, encounter.id) || moment === 'after' && !player.campaign.includes(encounter.id)) return '';
  const character = STORY_CHARACTERS.find(c => c.id === scene.character)!;
  return '<details class="panel campaign-story" ' + (moment === 'before' ? 'open' : '') + '><summary>' + (moment === 'after' ? 'Recovered scene: ' : 'Character encounter: ') + esc(scene.title) + '</summary><div class="story-conversation">' + creature(character.shape, ELEMENT_BY_ID[character.element].color) + '<div><span class="eyebrow">' + esc(character.role) + '</span><h3>' + esc(character.name) + '</h3>' + scene[moment].map(line => '<p>“' + esc(line) + '”</p>').join('') + '</div></div></details>';
}

export function renderRecoveredScenes(player: Player) {
  const scenes = STORY_SCENES.filter(s => player.campaign.includes(s.encounter));
  if (!scenes.length) return '';
  return '<section class="recovered-scenes"><h2>People of the broken world</h2><p>Recovered conversations from your expeditions.</p><div class="codex-grid">' + scenes.map(scene => {
    const character = STORY_CHARACTERS.find(c => c.id === scene.character)!;
    return '<article class="panel content-panel" data-scene="' + scene.encounter + '"><span class="eyebrow">' + esc(character.name) + ' · ' + esc(character.role) + '</span><h3>' + esc(scene.title) + '</h3>' + scene.after.map(line => '<p>' + esc(line) + '</p>').join('') + '</article>';
  }).join('') + '</div></section>';
}
