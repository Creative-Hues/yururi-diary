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

// 1つ上(dir=-1)・下(dir=1)へ動かし、順番を 0,1,2… と振り直す
export async function moveChoice(list, id, dir) {
  const rows = await getChoices(list);
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await withTx('choices', 'readwrite', (tx) => {
    const os = tx.objectStore('choices');
    rows.forEach((r, order) => os.put({ ...r, order }));
  });
}
