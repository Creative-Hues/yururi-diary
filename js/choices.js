// 本人が編集できる一覧(choices ストア):体調の選択肢・薬など

import { getAll, put, del, withTx } from './db.js';
import { uuid, nowIso } from './util.js';

export async function getChoices(list) {
  const rows = await getAll('choices', 'list', list);
  return rows.sort((a, b) => a.order - b.order);
}

export async function addChoice(list, label, extra = {}) {
  const rows = await getChoices(list);
  const order = rows.length ? rows[rows.length - 1].order + 1 : 0;
  return put('choices', { id: uuid(), list, label, order, createdAt: nowIso(), ...extra });
}

export const updateChoice = (choice) => put('choices', choice);

export const deleteChoice = (id) => del('choices', id);

// ids の順番に並べ替え、順番を 0,1,2… と振り直す
export async function reorderChoices(list, ids) {
  const rows = await getChoices(list);
  const byId = new Map(rows.map((r) => [r.id, r]));
  // ids に無いもの(念のため)は後ろに残す
  const sorted = [...ids.map((id) => byId.get(id)).filter(Boolean), ...rows.filter((r) => !ids.includes(r.id))];
  await withTx('choices', 'readwrite', (tx) => {
    const os = tx.objectStore('choices');
    sorted.forEach((r, order) => os.put({ ...r, order }));
  });
}
