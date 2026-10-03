// 相談したいことメモ(3-8)
// #/consult … 見る画面(未相談・相談済み)
// #/consult-new … 書く画面
// #/consult-edit/<id> … 直す画面(相談済みの切り替え・削除も)

import { get, getAll, put, del } from '../db.js';
import { datetimeField, readAt, formActionsHtml, notFoundHtml, watchDirty } from '../components.js';
import { href, guardLeave } from '../router.js';
import { confirmDialog, toast } from '../ui.js';
import { esc, localDateTime, nowIso, uuid, formatDateJa, parseLocalDateTime } from '../util.js';

const dateLabel = (at) => formatDateJa(parseLocalDateTime(at));

export async function renderConsult(el, params, isStale) {
  const rows = (await getAll('consults')).sort((a, b) => a.at.localeCompare(b.at));
  if (isStale()) return;
  const open = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const card = (r) => `
    <div class="card consult-card${r.done ? ' is-done' : ''}" data-id="${esc(r.id)}">
      <a class="consult-main" href="${href('consult-edit', r.id)}">
        <p class="view-text">${esc(r.text)}</p>
        <span class="small muted">${dateLabel(r.at)}に書いたメモ${r.done && r.doneAt ? `・${formatDateJa(new Date(r.doneAt))}に相談済み` : ''}</span>
      </a>
      <button type="button" class="check-btn" data-act="toggle" aria-pressed="${!!r.done}">${r.done ? '未相談にもどす' : '✓ 相談した'}</button>
    </div>`;

  el.innerHTML = `
    <a class="btn btn-primary btn-block add-btn" href="${href('consult-new')}">＋ 書く</a>
    <section class="group">
      <h2 class="section-title">まだ相談していないこと(${open.length})</h2>
      ${open.length ? open.map(card).join('') : '<p class="empty">いまはありません</p>'}
    </section>
    ${done.length ? `
      <details class="group done-list">
        <summary class="section-title">相談済み(${done.length})</summary>
        ${done.map(card).join('')}
      </details>` : ''}
  `;

  el.querySelectorAll('[data-act="toggle"]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = rows.find((x) => x.id === b.closest('[data-id]').dataset.id);
      await setDone(r, !r.done);
      toast(r.done ? '相談済みにしました' : '未相談にもどしました');
      renderConsult(el, params, isStale);
    });
  });
}

function setDone(r, done) {
  r.done = done ? 1 : 0;
  r.doneAt = done ? nowIso() : null;
  r.updatedAt = nowIso();
  return put('consults', r);
}

export function renderConsultNew(el, params, isStale) {
  if (isStale()) return;
  return consultForm(el, null);
}

export async function renderConsultEdit(el, [id], isStale) {
  const rec = await get('consults', id);
  if (isStale()) return;
  if (!rec) {
    el.innerHTML = notFoundHtml;
    return;
  }
  return consultForm(el, rec);
}

function consultForm(el, rec) {
  const initialAt = rec?.at ?? localDateTime();
  el.innerHTML = `
    <div class="card">
      <label class="field">
        <span class="field-label">診察やスタッフさんに相談したいこと</span>
        <textarea class="input" name="text" rows="6">${esc(rec?.text ?? '')}</textarea>
      </label>
      <label class="check-row">
        <input type="checkbox" name="done" ${rec?.done ? 'checked' : ''}>
        <span>相談済み</span>
      </label>
      <div class="mt-field">${datetimeField(initialAt, '書いた日時')}</div>
    </div>
    ${formActionsHtml(rec)}
  `;

  let dirty = false;
  watchDirty(el, () => { dirty = true; });
  const guard = guardLeave(() => dirty);

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const text = el.querySelector('[name="text"]').value.trim();
    if (!text) {
      toast('相談したいことを書いてね');
      return;
    }
    const done = el.querySelector('[name="done"]').checked;
    const t = nowIso();
    const row = rec ?? { id: uuid(), createdAt: t, done: 0, doneAt: null };
    row.text = text;
    row.at = readAt(el, initialAt);
    row.updatedAt = t;
    if (!!row.done !== done) {
      row.done = done ? 1 : 0;
      row.doneAt = done ? t : null;
    }
    await put('consults', row);
    await guard.leave(href('consult'));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'このメモを削除しますか?', message: '削除すると、もとに戻せません。', ok: '削除する', danger: true });
    if (!ok) return;
    await del('consults', rec.id);
    toast('削除しました');
    await guard.leave(href('consult'));
  });

  return guard.release;
}
