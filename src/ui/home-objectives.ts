import type { Player } from '../types.js';
import { QUESTS, ACHIEVEMENTS } from '../data/systems.js';
import { questProgress } from '../core/meta.js';
import { dailyGoals, dailyGoalProgress } from '../core/learning.js';

export function renderHomeObjectives(player: Player, now = Date.now()) {
  const rewardCount = QUESTS.filter(q => !player.quests.includes(q.id) && questProgress(player, q) >= q.target).length + ACHIEVEMENTS.filter(a => !player.achievementClaims.includes(a.id) && questProgress(player, a) >= a.target).length;
  const day = dailyGoals(now), daily = player.learning.daily;
  const goal = day.goals.find(g => daily.day !== day.day || !daily.claims.includes(g.id));
  const progress = goal ? Math.min(goal.target, dailyGoalProgress(player, goal.id, now)) : 0;
  return '<div class="two-column home-objectives"><section class="panel content-panel"><div class="eyebrow">TODAY’S QUESTION · UTC</div><h2>' + (goal?.name ?? 'Today’s questions, answered.') + '</h2><p>' + (goal?.description ?? 'You have claimed all three daily learning rewards. Tomorrow brings another elemental thread.') + '</p>'
    + (goal ? '<div class="meter"><i style="width:' + progress / goal.target * 100 + '%"></i></div><p class="subtle">' + progress + ' / ' + goal.target + ' · 25 gold · 3 knowledge · 5 essence</p>' + (progress >= goal.target ? '<button class="button primary" data-action="x-daily-goal" data-id="' + goal.id + '">Claim daily reward</button>' : '<a class="text-link" href="#' + (goal.id === 'practice' ? 'lab' : 'battle') + '">Pursue this question →</a>') : '')
    + '</section><section class="panel content-panel"><div class="eyebrow">YOUR REWARDS</div><h2>' + rewardCount + ' reward' + (rewardCount === 1 ? '' : 's') + ' ready to claim</h2><p>Completed quests and achievements recognize the theories you have put into practice.</p>' + (rewardCount ? '<button class="button primary" data-action="x-claim-all">Claim ' + rewardCount + ' completed rewards</button>' : '<a class="text-link" href="#journal">Find your next objective →</a>') + '</section></div>';
}
