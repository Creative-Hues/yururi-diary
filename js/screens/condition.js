// 体調の記録(3-2)
// #/condition … 新しく記録(下に今日の記録)
// #/condition/<id> … その記録を直す

import { get, getRecordsByType, newRecord, saveRecord } from '../db.js';
import { getChoices } from '../choices.js';
import { LISTS } from '../constants.js';
import { datetimeField, readAt, recItem, sortByAt, timeOf } from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, goBack } from '../router.js';
import { toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

const GROUPS = [
  { key: 'body', title: '身体', list: LISTS.body },
  { key: 'mind', title: '心', list: LISTS.mind },
];

// 一覧の1行に出す要約
export function conditionSummary(data) {
  const parts = GROUPS.map((g) => [...(data[g.key] ?? []).map((c) => c.label), data[`${g.key}Other`]].filter(Boolean).join('・'));
  return parts.filter(Boolean).join(' / ');
}

export async function renderCondition(el, [id], isStale) {
  const today = dateKey();
  const [choices, rec, todays] = await Promise.all([
    Promise.all(GROUPS.map((g) => getChoices(g.list))),
    id ? get('records', id) : null,
    id ? [] : getRecordsByType('condition', today, today),
  ]);
  if (isStale()) return;
  if (id && rec?.type !== 'condition') {
    el.innerHTML = '<div class="card"><p>この記録は見つかりませんでした。</p></div>';
    return;
  }

  const groupHtml = (g, i) => {
    const selected = rec?.data[g.key] ?? [];
    const selectedIds = new Set(selected.map((c) => c.id));
    // 選択肢から消したものでも、この記録で選ばれていれば表示する
    const opts = [...choices[i], ...selected.filter((s) => !choices[i].some((c) => c.id === s.id))];
    return `
      <section class="group">
        <h2 class="section-title">${g.title}</h2>
        <div class="card">
          <div class="chips" data-group="${g.key}">
            ${opts.map((c) => `<button type="button" class="chip" data-id="${esc(c.id)}" data-label="${esc(c.label)}" aria-pressed="${selectedIds.has(c.id)}">${esc(c.label)}</button>`).join('')}
          </div>
          <label class="field">
            <span class="field-label">その他</span>
            <textarea class="input" name="${g.key}Other" rows="2" placeholder="自由に書けます">${esc(rec?.data[`${g.key}Other`] ?? '')}</textarea>
          </label>
        </div>
      </section>`;
  };

  el.innerHTML = `
    ${GROUPS.map(groupHtml).join('')}
    <div class="card mt-group">${datetimeField(rec?.at ?? localDateTime())}</div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">${rec ? '保存する' : '記録する'}</button>
      ${rec ? '<button type="button" class="btn btn-ghost-danger btn-block" id="delete-btn">この記録を削除</button>' : ''}
    </div>
    <p class="hint">どれか1つだけでも記録できます。</p>
    ${rec ? '' : `
      <section class="group">
        <h2 class="section-title">今日の体調</h2>
        ${todays.length
          ? `<div class="card rows">${sortByAt(todays).map((r) => recItem({ id: r.id, time: timeOf(r.at), main: esc(conditionSummary(r.data)) })).join('')}</div>`
          : '<p class="empty">まだ記録はありません</p>'}
      </section>`}
    <a class="link-row" href="${href('edit-condition')}">選択肢を追加・並び替えする ›</a>
  `;

  el.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')));
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const data = {};
    for (const g of GROUPS) {
      data[g.key] = [...el.querySelectorAll(`[data-group="${g.key}"] .chip[aria-pressed="true"]`)]
        .map((c) => ({ id: c.dataset.id, label: c.dataset.label }));
      data[`${g.key}Other`] = el.querySelector(`[name="${g.key}Other"]`).value.trim();
    }
    if (!GROUPS.some((g) => data[g.key].length || data[`${g.key}Other`])) {
      toast('どれか1つ選ぶか、書いてから保存してね');
      return;
    }
    const at = readAt(el, rec?.at);
    if (rec) {
      rec.data = data;
      rec.at = at;
      await saveRecord(rec);
      toast('保存しました');
      goBack();
    } else {
      await saveRecord(newRecord('condition', data, at));
      toast('記録しました');
      renderCondition(el, [], isStale);
    }
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (await deleteRecordWithConfirm(rec)) goBack();
  });

  el.querySelectorAll('.rec-item').forEach((b) => {
    b.addEventListener('click', () => { location.hash = href('condition', b.dataset.id); });
  });
}
