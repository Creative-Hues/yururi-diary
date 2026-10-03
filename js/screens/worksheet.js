// 整理シート(3-8):気になること → つらさ(0〜10) → できそうなこと
// #/worksheet … 見る画面(新しい順にすべて)
// #/worksheet-new … 書く画面
// #/worksheet-edit/<id> … 直す画面

import { get, getAll, newRecord, saveRecord } from '../db.js';
import { LEVEL_MIN, LEVEL_MAX } from '../constants.js';
import { datetimeField, readAt, formActionsHtml, notFoundHtml, watchDirty, timeOf } from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, guardLeave } from '../router.js';
import { toast } from '../ui.js';
import { esc, localDateTime, formatDateJa, parseLocalDateTime } from '../util.js';

const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);

function levelHtml(level) {
  if (level == null) return '';
  const dots = LEVELS.slice(1).map((n) => `<i class="${n <= level ? 'on' : ''}"></i>`).join('');
  return `
    <div class="ws-row">
      <span class="ws-label">つらさ</span>
      <span class="ws-level"><strong>${level}</strong><small>/${LEVEL_MAX}</small><span class="level-dots" aria-hidden="true">${dots}</span></span>
    </div>`;
}

export async function renderWorksheet(el, params, isStale) {
  const rows = (await getAll('records', 'type', 'worksheet')).sort((a, b) => b.at.localeCompare(a.at));
  if (isStale()) return;

  el.innerHTML = `
    <a class="btn btn-primary btn-block add-btn" href="${href('worksheet-new')}">＋ 書く</a>
    ${rows.length ? rows.map((r) => `
      <a class="card view-card" href="${href('worksheet-edit', r.id)}">
        <div class="card-head">
          <span class="card-title">${formatDateJa(parseLocalDateTime(r.at))}</span>
          <span class="card-time">${timeOf(r.at)}<span class="chev" aria-hidden="true">›</span></span>
        </div>
        ${r.data.worry ? `<div class="ws-row"><span class="ws-label">気になること</span><p class="view-text">${esc(r.data.worry)}</p></div>` : ''}
        ${levelHtml(r.data.level)}
        ${r.data.ideas ? `<div class="ws-row"><span class="ws-label">できそうなこと</span><p class="view-text">${esc(r.data.ideas)}</p></div>` : ''}
      </a>`).join('') : '<p class="empty">まだ書いていません</p>'}
  `;
}

export function renderWorksheetNew(el, params, isStale) {
  if (isStale()) return;
  return worksheetForm(el, null);
}

export async function renderWorksheetEdit(el, [id], isStale) {
  const rec = await get('records', id);
  if (isStale()) return;
  if (rec?.type !== 'worksheet') {
    el.innerHTML = notFoundHtml;
    return;
  }
  return worksheetForm(el, rec);
}

function worksheetForm(el, rec) {
  const initialAt = rec?.at ?? localDateTime();
  let level = rec?.data.level ?? null;

  el.innerHTML = `
    <div class="card">
      <label class="field">
        <span class="field-label">① 気になること</span>
        <textarea class="input" name="worry" rows="4">${esc(rec?.data.worry ?? '')}</textarea>
      </label>
      <div class="field">
        <span class="field-label">② つらさ(タップで選ぶ・もう一度タップで取り消し)</span>
        <div class="level-grid" role="group" aria-label="つらさ">
          ${LEVELS.map((n) => `<button type="button" class="level-btn${n === LEVEL_MIN ? ' level-zero' : ''}" data-level="${n}" aria-pressed="${n === level}">${n === LEVEL_MIN ? `${n} つらくない` : n}</button>`).join('')}
        </div>
        <div class="level-scale"><span>10 とてもつらい</span></div>
      </div>
      <label class="field">
        <span class="field-label">③ できそうなこと</span>
        <textarea class="input" name="ideas" rows="4">${esc(rec?.data.ideas ?? '')}</textarea>
      </label>
      <div class="mt-field">${datetimeField(initialAt)}</div>
    </div>
    <p class="hint">書けるところだけで保存できます。</p>
    ${formActionsHtml(rec)}
  `;

  let dirty = false;
  watchDirty(el, () => { dirty = true; });
  el.querySelectorAll('.level-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const n = Number(b.dataset.level);
      level = level === n ? null : n;
      dirty = true;
      el.querySelectorAll('.level-btn').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.level) === level)));
    });
  });

  const guard = guardLeave(() => dirty);

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const worry = el.querySelector('[name="worry"]').value.trim();
    const ideas = el.querySelector('[name="ideas"]').value.trim();
    if (!worry && !ideas && level == null) {
      toast('どれか1つ書くか、選んでから保存してね');
      return;
    }
    const at = readAt(el, initialAt);
    const data = { worry, level, ideas };
    if (rec) {
      rec.data = data;
      rec.at = at;
      await saveRecord(rec);
    } else {
      await saveRecord(newRecord('worksheet', data, at));
    }
    await guard.leave(href('worksheet'));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (await deleteRecordWithConfirm(rec)) await guard.leave(href('worksheet'));
  });

  return guard.release;
}
