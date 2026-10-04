// 記録の画面で共通して使う部品

import { dateKey, esc, localDateTime } from './util.js';

export const timeOf = (at) => at.slice(11, 16);

// 今日なら「21:15」、ほかの日なら「10/2 21:15」(24時間表示)
export function atLabel(at) {
  if (at.slice(0, 10) === dateKey()) return timeOf(at);
  const [, m, d] = at.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)} ${timeOf(at)}`;
}

// ①〜⑳、それより多いときは (21)
export function circled(n) {
  return n >= 1 && n <= 20 ? String.fromCharCode(0x245f + n) : `(${n})`;
}

export function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

export const isDateKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');

// 全角の数字・小数点を半角にして数値にする。空なら null、数字でなければ NaN
export function parseNum(s) {
  const t = String(s ?? '').trim()
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// 日時の入力欄
export function datetimeField(at, label = '日時') {
  return `
    <label class="field">
      <span class="field-label">${esc(label)}</span>
      <input type="datetime-local" class="input" name="at" value="${esc(at)}">
    </label>`;
}

// 入力欄の日時を読む。空にされていたら fallback(初期値は現在時刻)
export function readAt(root, fallback = localDateTime()) {
  const v = root.querySelector('[name="at"]')?.value ?? '';
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? v.slice(0, 16) : fallback;
}

// 日付を切り替える部品(食事・バイタル)
export function dayNavHtml(date) {
  const isToday = date === dateKey();
  return `
    <div class="day-nav">
      <button type="button" class="day-btn" data-day="-1" aria-label="前の日">‹</button>
      <label class="day-label">
        <input type="date" class="day-input" value="${esc(date)}" aria-label="日付">
        ${isToday ? '<span class="today-badge">今日</span>' : ''}
      </label>
      <button type="button" class="day-btn" data-day="1" aria-label="次の日">›</button>
    </div>`;
}

export function bindDayNav(root, date, onChange) {
  root.querySelectorAll('.day-btn').forEach((b) => {
    b.addEventListener('click', () => onChange(shiftDate(date, Number(b.dataset.day))));
  });
  root.querySelector('.day-input').addEventListener('change', (e) => {
    if (isDateKey(e.target.value)) onChange(e.target.value);
  });
}

// 記録の一覧の1行
export function recItem({ id, time, main, sub = '' }) {
  return `
    <button type="button" class="rec-item" data-id="${esc(id)}">
      <span class="rec-time">${esc(time)}</span>
      <span class="rec-main">${main}${sub ? `<span class="rec-sub">${sub}</span>` : ''}</span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
}

export const sortByAt = (rows) =>
  rows.sort((a, b) => a.at.localeCompare(b.at) || a.createdAt.localeCompare(b.createdAt));

// 複数行の文を表示用の HTML にする。行頭が「・」「-」などの行は箇条書きにする
export function linesHtml(text) {
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${l}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    const m = line.match(/^[・\-•*●○]\s*(.*)$/);
    if (m) {
      list.push(esc(m[1]));
      continue;
    }
    flush();
    if (line) out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join('');
}

// 入力欄のカーソル位置に文を入れる(まだ触っていない欄なら最後に足す)。行の途中なら改行してから入れる
export function insertText(ta, text) {
  const touched = ta.dataset.touched === '1';
  const start = touched ? ta.selectionStart : ta.value.length;
  const end = touched ? ta.selectionEnd : ta.value.length;
  const before = ta.value.slice(0, start);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  ta.setRangeText(prefix + text, start, end, 'end');
  ta.dataset.touched = '1';
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

export function trackCursor(ta) {
  ta.addEventListener('focus', () => { ta.dataset.touched = '1'; });
}

// 保存・削除ボタン
export function formActionsHtml(rec, saveLabel = '保存する') {
  return `
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">${saveLabel}</button>
      ${rec ? '<button type="button" class="btn btn-ghost-danger btn-block" id="delete-btn">この記録を削除</button>' : ''}
    </div>`;
}

// 選択肢・名前などを編集する画面への入り口(えんぴつ付きのボタン)。見出しの横に置き、どの画面でも同じ見た目にする。
// to … 開く画面の href。button: true のときは <button>(ダイアログの中で data-value を付けて使う)
export const PENCIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
export function editLinkHtml(to, label = '選択肢を編集', { button = false, attrs = '' } = {}) {
  return button
    ? `<button type="button" class="edit-link" ${attrs}>${PENCIL_SVG}<span>${esc(label)}</span></button>`
    : `<a class="edit-link" href="${esc(to)}" ${attrs}>${PENCIL_SVG}<span>${esc(label)}</span></a>`;
}

// 見出しと、その横の編集ボタン
export function headRowHtml(headHtml, editHtml) {
  return `<div class="head-row">${headHtml}${editHtml}</div>`;
}

export const notFoundHtml ='<div class="card"><p>この記録は見つかりませんでした。</p></div>';


// 数値を表示用に(計算などで出る 36.800000000000004 のような端数を丸める。最大小数2桁)
export const fmtNum = (v) => (v == null || v === '' ? '' : String(Math.round(Number(v) * 100) / 100));
