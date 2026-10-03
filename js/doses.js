// 服薬の回数と①②の番号
// 番号は保存せず、表示のたびに「同じ日・同じ薬・時刻順」で数える。
// そのため時刻を編集すると自動で並び直る。

import { sortByAt } from './components.js';

// 記録 id → 番号(1始まり)
export function numberDoses(records) {
  const seen = new Map();
  const numbers = new Map();
  for (const r of sortByAt([...records])) {
    const key = `${r.date}|${r.data.medicineId}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    numbers.set(r.id, n);
  }
  return numbers;
}

// 薬 id → 回数
export function countDoses(records) {
  const counts = new Map();
  for (const r of records) counts.set(r.data.medicineId, (counts.get(r.data.medicineId) ?? 0) + 1);
  return counts;
}

export const reachedLimit = (count, limit) => limit != null && count >= limit;

export function countText(count, limit) {
  return limit != null ? `今日 ${count}/${limit}回` : `今日 ${count}回`;
}
