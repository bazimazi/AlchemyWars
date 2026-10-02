export function mergeModifiers(...sources) {
  const result = {};
  for (const source of sources.filter(Boolean)) for (const [key, value] of Object.entries(source)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (Array.isArray(value)) result[key] = [...new Set([...(result[key] ?? []), ...value])];
    else if (key === 'tagPower' && value && typeof value === 'object') {
      result[key] ??= {};
      for (const [tag, multiplier] of Object.entries(value)) if (!['__proto__', 'constructor', 'prototype'].includes(tag)) result[key][tag] = (result[key][tag] ?? 1) * multiplier;
    }
    else if (value && typeof value === 'object') result[key] = mergeModifiers(result[key], value);
    else if (typeof value === 'number') result[key] = key.endsWith('Multiplier') ? (result[key] ?? 1) * value : (result[key] ?? 0) + value;
  }
  return result;
}
