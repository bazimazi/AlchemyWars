import type { Player } from '../types.js';
import { ACHIEVEMENTS } from '../data/systems.js';
import { questProgress } from '../core/meta.js';
import { escapeHtml as esc } from './dom.js';
import { icon } from './art.js';

export function renderAchievements(player: Player) {
  return '<div class="achievement-list">' + ACHIEVEMENTS.map(a => {
    const progress = Math.min(a.target, questProgress(player, a)), earned = progress >= a.target, claimed = player.achievementClaims.includes(a.id);
    return '<article class="panel achievement ' + (earned ? 'earned' : '') + '" data-achievement="' + a.id + '">' + icon(earned ? 'star' : 'lock') + '<span><strong>' + esc(a.name) + '</strong><small>' + esc(a.description ?? '') + '</small><small>' + a.gold + ' gold, ' + a.knowledge + ' knowledge</small></span><div class="achievement-progress"><div class="meter" role="progressbar" aria-label="' + esc(a.name) + ' progress" aria-valuemin="0" aria-valuemax="' + a.target + '" aria-valuenow="' + progress + '"><i style="width:' + progress / a.target * 100 + '%"></i></div><small>' + progress + ' / ' + a.target + '</small></div><button class="button secondary" data-action="x-achievement" data-id="' + a.id + '"' + (claimed || !earned ? ' disabled' : '') + '>' + (claimed ? 'Reward claimed' : 'Claim achievement reward') + '</button></article>';
  }).join('') + '</div>';
}
