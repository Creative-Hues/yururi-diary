// 日記(3-6):一日の日記・ひとこと日記・ランダム見返し・お気に入り
// #/diary-day/<日付>            … 一日の日記を見る画面
// #/diary-day-new/<日付>        … 書く画面
// #/diary-day-edit/<id>         … 直す画面
// (ひとこと日記は diary-hitokoto / -new / -edit)
// #/diary-random/<種類>/<id>    … ランダム見返し(id を URL に持つので、直して戻っても同じものが出る)
// #/diary-favorites             … お気に入り一覧

import { get, getAll, getRecordsByType, newRecord, saveRecord } from '../db.js';
import { getChoices } from '../choices.js';
import { LISTS } from '../constants.js';
import {
  dayNavHtml, bindDayNav, isDateKey, timeOf, datetimeField, readAt, sortByAt,
  insertText, trackCursor, formActionsHtml, notFoundHtml, watchDirty,
} from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, guardLeave } from '../router.js';
import { toast } from '../ui.js';
import { dateKey, esc, localDateTime, formatDateJa, parseLocalDateTime } from '../util.js';

const KINDS = {
  diary: {
    type: 'diary', name: '一日の日記', short: '日記',
    view: 'diary-day', newRoute: 'diary-day-new', editRoute: 'diary-day-edit',
    starter: LISTS.diaryStarter, prompt: LISTS.diaryPrompt,
    rows: 10, placeholder: '今日のことを、自由に書けます',
  },
  hitokoto: {
    type: 'hitokoto', name: 'ひとこと日記', short: 'ひとこと',
    view: 'diary-hitokoto', newRoute: 'diary-hitokoto-new', editRoute: 'diary-hitokoto-edit',
    starter: LISTS.hitokotoStarter, prompt: LISTS.hitokotoPrompt,
    rows: 3, placeholder: '1〜2行でOK',
  },
};
const kindOf = (type) => (type === 'hitokoto' ? KINDS.hitokoto : KINDS.diary);
const OTHER_DAY_TIME = '21:00';

// 「10月3日(土) 21:00」(今年でなければ年も付ける)
function dateTimeLabel(at) {
  const d = parseLocalDateTime(at);
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年` : '';
  return `${year}${formatDateJa(d)} ${timeOf(at)}`;
}

const promptHtml = (prompt) => (prompt ? `<p class="prompt-label">お題:${esc(prompt)}</p>` : '');
const favMark = (rec) => (rec.data.favorite ? '<span class="fav-mark" aria-label="お気に入り">★</span>' : '');

// ---- 見る画面 ----

async function renderView(kind, el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const rows = sortByAt(await getRecordsByType(kind.type, date, date));
  if (isStale()) return;
  const dayWord = date === dateKey() ? '今日' : 'この日';

  el.innerHTML = `
    ${dayNavHtml(date)}
    ${kind.type === 'hitokoto' ? `<p class="count-line">${dayWord} <strong>${rows.length}件</strong></p>` : ''}
    <a class="btn btn-primary btn-block add-btn" href="${href(kind.newRoute, date)}">＋ 書く</a>
    ${rows.length ? rows.map((r) => `
      <a class="card view-card" href="${href(kind.editRoute, r.id)}">
        <div class="card-head">
          <span class="card-time">${timeOf(r.at)}</span>
          <span class="card-time">${favMark(r)}<span class="chev" aria-hidden="true">›</span></span>
        </div>
        ${promptHtml(r.data.prompt)}
        <p class="view-text">${esc(r.data.text)}</p>
      </a>`).join('') : `<p class="empty">${dayWord}はまだ書いていません</p>`}
  `;
  bindDayNav(el, date, (next) => location.replace(href(kind.view, next)));
}

export const renderDiaryDay = (...a) => renderView(KINDS.diary, ...a);
export const renderHitokoto = (...a) => renderView(KINDS.hitokoto, ...a);

// ---- 書く・直す画面 ----

async function renderNew(kind, el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  return diaryForm(kind, el, { date }, isStale);
}

async function renderEdit(kind, el, [id], isStale) {
  const rec = await get('records', id);
  if (isStale()) return;
  if (rec?.type !== kind.type) {
    el.innerHTML = notFoundHtml;
    return;
  }
  return diaryForm(kind, el, { rec, date: rec.date }, isStale);
}

export const renderDiaryDayNew = (...a) => renderNew(KINDS.diary, ...a);
export const renderDiaryDayEdit = (...a) => renderEdit(KINDS.diary, ...a);
export const renderHitokotoNew = (...a) => renderNew(KINDS.hitokoto, ...a);
export const renderHitokotoEdit = (...a) => renderEdit(KINDS.hitokoto, ...a);

async function diaryForm(kind, el, { rec = null, date }, isStale) {
  const [starters, prompts] = await Promise.all([getChoices(kind.starter), getChoices(kind.prompt)]);
  if (isStale()) return;
  const initialAt = rec?.at ?? (date === dateKey() ? localDateTime() : `${date}T${OTHER_DAY_TIME}`);
  let prompt = rec?.data.prompt ?? '';
  let favorite = rec?.data.favorite ? 1 : 0;

  el.innerHTML = `
    <div class="card">
      <div class="prompt-box">
        <div class="prompt-current" ${prompt ? '' : 'hidden'}>
          <span class="prompt-head">お題</span>
          <p class="prompt-text">${esc(prompt)}</p>
          <button type="button" class="icon-btn prompt-clear" aria-label="お題を消す">×</button>
        </div>
        ${prompts.length ? `<button type="button" class="btn btn-small" id="draw-prompt">🎲 ${prompt ? 'ほかのお題' : 'お題をひく'}</button>` : ''}
      </div>
      ${starters.length ? `
        <div class="field">
          <span class="field-label">書き出し(タップすると本文に入ります)</span>
          <div class="chips">${starters.map((s) => `<button type="button" class="chip" data-text="${esc(s.label)}">${esc(s.label)}</button>`).join('')}</div>
        </div>` : ''}
      <label class="field">
        <span class="field-label">本文</span>
        <textarea class="input" name="text" rows="${kind.rows}" placeholder="${kind.placeholder}">${esc(rec?.data.text ?? '')}</textarea>
      </label>
      <button type="button" class="fav-toggle mt" aria-pressed="${!!favorite}">${favorite ? '★' : '☆'} お気に入り</button>
      <div class="mt-field">${datetimeField(initialAt)}</div>
    </div>
    ${formActionsHtml(rec)}
    <a class="link-row" href="${href('edit-diary')}">お題・書き出しを追加・並び替えする ›</a>
  `;

  let dirty = false;
  const setDirty = () => { dirty = true; };
  watchDirty(el, setDirty);
  const ta = el.querySelector('[name="text"]');
  trackCursor(ta);

  // お題
  const box = el.querySelector('.prompt-current');
  const drawBtn = el.querySelector('#draw-prompt');
  const showPrompt = () => {
    box.hidden = !prompt;
    box.querySelector('.prompt-text').textContent = prompt;
    if (drawBtn) drawBtn.textContent = `🎲 ${prompt ? 'ほかのお題' : 'お題をひく'}`;
  };
  drawBtn?.addEventListener('click', () => {
    const pool = prompts.map((p) => p.label).filter((p) => p !== prompt);
    if (!pool.length) return;
    prompt = pool[Math.floor(Math.random() * pool.length)];
    setDirty();
    showPrompt();
  });
  box.querySelector('.prompt-clear').addEventListener('click', () => {
    prompt = '';
    setDirty();
    showPrompt();
  });

  // 書き出しの型
  el.querySelectorAll('.chip[data-text]').forEach((c) => {
    c.addEventListener('click', () => insertText(ta, c.dataset.text));
  });

  // お気に入り
  const favBtn = el.querySelector('.fav-toggle');
  favBtn.addEventListener('click', () => {
    favorite = favorite ? 0 : 1;
    favBtn.setAttribute('aria-pressed', String(!!favorite));
    favBtn.textContent = `${favorite ? '★' : '☆'} お気に入り`;
    setDirty();
  });

  const guard = guardLeave(() => dirty);

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const text = ta.value.trim();
    if (!text) {
      toast('本文を書いてね');
      return;
    }
    const at = readAt(el, initialAt);
    const data = { text, prompt, favorite };
    if (rec) {
      rec.data = data;
      rec.at = at;
      await saveRecord(rec);
    } else {
      await saveRecord(newRecord(kind.type, data, at));
    }
    await guard.leave(href(kind.view, at.slice(0, 10)));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (await deleteRecordWithConfirm(rec)) await guard.leave(href(kind.view, rec.date));
  });

  return guard.release;
}

// ---- お気に入り ----

async function allEntries(types = ['diary', 'hitokoto']) {
  return (await Promise.all(types.map((t) => getAll('records', 'type', t)))).flat();
}

const entryCard = (r, clamp = false) => `
  <a class="card view-card" href="${href(kindOf(r.type).editRoute, r.id)}">
    <div class="card-head">
      <span class="kind-badge">${kindOf(r.type).short}</span>
      <span class="card-time">${dateTimeLabel(r.at)}${favMark(r)}<span class="chev" aria-hidden="true">›</span></span>
    </div>
    ${promptHtml(r.data.prompt)}
    <p class="view-text${clamp ? ' clamp' : ''}">${esc(r.data.text)}</p>
  </a>`;

export async function renderFavorites(el, params, isStale) {
  const rows = (await allEntries()).filter((r) => r.data.favorite).sort((a, b) => b.at.localeCompare(a.at));
  if (isStale()) return;
  el.innerHTML = rows.length
    ? rows.map((r) => entryCard(r, true)).join('')
    : '<div class="card"><p>まだお気に入りはありません。</p><p class="muted small">日記を書く画面の「☆ お気に入り」で印を付けると、ここに並びます。</p></div>';
}

// ---- ランダム見返し ----

const FILTERS = [
  { key: 'all', label: 'すべて', types: ['diary', 'hitokoto'] },
  { key: 'diary', label: '日記', types: ['diary'] },
  { key: 'hitokoto', label: 'ひとこと', types: ['hitokoto'] },
];

export async function renderRandom(el, [filterParam, id], isStale) {
  const filter = FILTERS.find((f) => f.key === filterParam) ?? FILTERS[0];
  const all = await allEntries(filter.types);
  if (isStale()) return;
  // 「過去の」日記から選ぶ(今日の分しかないときは今日の分から)
  const past = all.filter((r) => r.date < dateKey());
  const pool = past.length ? past : all;
  const pick = (exceptId) => {
    const choices = pool.filter((r) => r.id !== exceptId);
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  };

  let rec = all.find((r) => r.id === id);
  if (!rec && pool.length) {
    location.replace(href('diary-random', filter.key, pick().id));
    return;
  }

  el.innerHTML = `
    <div class="seg-row seg-row-top">
      ${FILTERS.map((f) => `<button type="button" class="seg-btn" data-filter="${f.key}" aria-pressed="${f === filter}">${f.label}</button>`).join('')}
    </div>
    ${rec ? `
      ${entryCard(rec)}
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-block" id="next-btn">🎲 もう1つ</button>
        <button type="button" class="btn btn-block fav-toggle-btn" id="fav-btn" aria-pressed="${!!rec.data.favorite}">${rec.data.favorite ? '★ お気に入りから外す' : '☆ お気に入りにする'}</button>
      </div>` : '<div class="card"><p>まだ日記がありません。</p><p class="muted small">書いた日記が、ここにランダムで1つずつ出てきます。</p></div>'}
  `;

  el.querySelectorAll('[data-filter]').forEach((b) => {
    b.addEventListener('click', () => location.replace(href('diary-random', b.dataset.filter)));
  });
  el.querySelector('#next-btn')?.addEventListener('click', () => {
    const next = pick(rec.id);
    if (!next) {
      toast('ほかにはまだありません');
      return;
    }
    location.replace(href('diary-random', filter.key, next.id));
  });
  el.querySelector('#fav-btn')?.addEventListener('click', async () => {
    rec.data.favorite = rec.data.favorite ? 0 : 1;
    await saveRecord(rec);
    toast(rec.data.favorite ? 'お気に入りにしました' : 'お気に入りから外しました');
    renderRandom(el, [filter.key, rec.id], isStale);
  });
}
