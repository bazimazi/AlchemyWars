import type { ReactionDefinition } from '../types.js';

const voices: { tags: string[]; notes: number[]; wave: 'sine' | 'triangle' }[] = [
  { tags: ['heat', 'burn'], notes: [349, 440, 523], wave: 'triangle' },
  { tags: ['water', 'wet', 'vapor'], notes: [392, 494, 587], wave: 'sine' },
  { tags: ['electricity', 'shock', 'chain'], notes: [523, 659, 784], wave: 'triangle' },
  { tags: ['growth', 'life', 'nature'], notes: [330, 440, 554], wave: 'sine' },
  { tags: ['cosmic', 'void', 'dark'], notes: [262, 392, 524], wave: 'sine' },
];
export function discoveryFeedback(rule: Pick<ReactionDefinition, 'tags' | 'rarity'>) {
  const voice = voices.find(v => v.tags.some(tag => rule.tags.includes(tag))) ?? { notes: [440, 554, 660], wave: 'sine' as const };
  const rare = ['Rare', 'Epic', 'Legendary', 'Mythic'].includes(rule.rarity);
  return { ...voice, grade: ['Legendary', 'Mythic'].includes(rule.rarity) ? 'exceptional' : rare ? 'rare' : 'ordinary', gain: rare ? .045 : .03, haptics: rare ? [25, 30, 40] : [20] };
}
