// バイタルの記録(3-5)
// #/vital/<YYYY-MM-DD> … 見る画面(その日の記録をカードで並べ、回数も表示。日付なしは今日)
// #/vital-new/<YYYY-MM-DD> … 入力画面(新しく記録)
// #/vital-edit/<id> … 入力画面(直す・削除)
// 「1回目」「2回目」は保存せず、その日の時刻順で数える(時刻を直すと並び直る)。

import { get, getRecordsByType, newRecord, saveRecord } from '../db.js';
import { getSettings } from '../prefs.js';
import { VITAL_FIELDS } from '../constants.js';
import { dayNavHtml, bindDayNav, isDateKey, timeOf, parseNum, datetimeField, readAt, sortByAt, fmtNum } from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, leaveTo } from '../router.js';
import { attachDraft, namedFields } from '../drafts.js';
import { toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

const OTHER_DAY_TIME = '12:00';

// 見る画面のカードの中身(入力のある項目だけ。血圧は上下をまとめる)
export function vitalItems(data) {
  const items = [];
  const add = (label, value, unit) => items.push(`<div class="vv-item"><dt>${label}</dt><dd>${value}<small>${unit}</small></dd></div>`);
  for (const f of VITAL_FIELDS) {
    if (f.key === 'bpLow') continue;
    if (f.key === 'bpHigh') {
      if (data.bpHigh != null || data.bpLow != null) add('血圧', `${fmtNum(data.bpHigh) || '–'} / ${fmtNum(data.bpLow) || '–'}`, 'mmHg');
      continue;
    }
    if (data[f.key] != null) add(f.label, esc(fmtNum(data[f.key])), f.unit);
  }
  return items.join('');
}

// ---- 見る画面 ----

export async function renderVital(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const [settings, rows] = await Promise.all([getSettings(), getRecordsByType('vital', date, date)]);
  if (isStale()) return;
  sortByAt(rows);
  const dayWord = date === dateKey() ? '今日' : 'この日';

  el.innerHTML = `
    ${dayNavHtml(date)}
    <p class="count-line">${dayWord} <strong>${rows.length}/${settings.vitalsPerDay}回</strong></p>
    <a class="btn btn-primary btn-block add-btn" href="${href('vital-new', date)}">＋ 記録する</a>
    ${rows.length ? rows.map((r, i) => `
      <a class="card view-card" href="${href('vital-edit', r.id)}">
        <div class="card-head">
          <span class="card-title">${i + 1}回目</span>
          <span class="card-time">${timeOf(r.at)}<span class="chev" aria-hidden="true">›</span></span>
        </div>
        <dl class="vital-view">${vitalItems(r.data)}</dl>
      </a>`).join('') : `<p class="empty">${dayWord}の記録はまだありません</p>`}
  `;

  bindDayNav(el, date, (next) => location.replace(href('vital', next)));
}

// ---- 入力画面 ----

export function renderVitalNew(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  if (isStale()) return;
  return vitalForm(el, { date });
}

export async function renderVitalEdit(el, [id], isStale) {
  const rec = await get('records', id);
  if (isStale()) return;
  if (rec?.type !== 'vital') {
    el.innerHTML = '<div class="card"><p>この記録は見つかりませんでした。</p></div>';
    return;
  }
  return vitalForm(el, { rec, date: rec.date });
}

async function vitalForm(el, { rec = null, date }) {
  const initialAt = rec?.at ?? (date === dateKey() ? localDateTime() : `${date}T${OTHER_DAY_TIME}`);

  el.innerHTML = `
    <div class="card">
      <div class="vital-grid">
        ${VITAL_FIELDS.map((f) => `
          <label class="field vital-field">
            <span class="field-label">${f.label}</span>
            <span class="with-unit">
              <input type="text" class="input" name="${f.key}" inputmode="${f.decimal ? 'decimal' : 'numeric'}" autocomplete="off" value="${esc(fmtNum(rec?.data[f.key]))}">
              <span class="unit">${f.unit}</span>
            </span>
          </label>`).join('')}
      </div>
      <div class="mt-field">${datetimeField(initialAt, '測った日時')}</div>
    </div>
    <p class="hint">測ったものだけ入力すれば保存できます。</p>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button>
      ${rec ? '<button type="button" class="btn btn-ghost-danger btn-block" id="delete-btn">この記録を削除</button>' : ''}
    </div>
  `;

  // 下書き(新しく記録するとき/直すときで別々)
  const fields = namedFields(el, [...VITAL_FIELDS.map((f) => f.key), 'at']);
  const draft = await attachDraft({
    key: rec ? `vital:edit:${rec.id}` : 'vital:new',
    root: el,
    getState: fields.get,
    setState: fields.set,
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const data = {};
    for (const f of VITAL_FIELDS) {
      const v = parseNum(el.querySelector(`[name="${f.key}"]`).value);
      if (Number.isNaN(v)) {
        toast(`${f.label}は、数字で入力してね`);
        return;
      }
      data[f.key] = v;
    }
    if (VITAL_FIELDS.every((f) => data[f.key] == null)) {
      toast('どれか1つ入力してね');
      return;
    }
    const at = readAt(el, initialAt);
    if (rec) {
      rec.data = data;
      rec.at = at;
      await saveRecord(rec);
    } else {
      await saveRecord(newRecord('vital', data, at));
    }
    await draft.done();
    await leaveTo(href('vital', at.slice(0, 10)));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (!(await deleteRecordWithConfirm(rec))) return;
    await draft.done();
    await leaveTo(href('vital', rec.date));
  });

  return () => draft.dispose();
}
