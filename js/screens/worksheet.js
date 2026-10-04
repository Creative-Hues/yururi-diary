// 整理シート(3-8):つらさ(0〜10、各段階に本人が名前を付けられる) → 詳細メモ
// #/worksheet … 見る画面(新しい順にすべて)
// #/worksheet-new … 書く画面
// #/worksheet-edit/<id> … 直す画面
// #/edit-levels … つらさの名前を変える画面
// 記録には、選んだときのつらさの名前も残す(あとで名前を変えても、過去の記録の表示は変わらない)。

import { get, getAll, newRecord, saveRecord } from '../db.js';
import { LEVEL_MIN, LEVEL_MAX } from '../constants.js';
import { getSettings, setSetting, levelName, DEFAULT_SETTINGS } from '../prefs.js';
import { datetimeField, readAt, formActionsHtml, notFoundHtml, timeOf, editLinkHtml } from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, leaveTo } from '../router.js';
import { attachDraft, namedFields } from '../drafts.js';
import { toast } from '../ui.js';
import { esc, localDateTime, formatDateJa, parseLocalDateTime } from '../util.js';

const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);

// 「7「名前」」の形の短い表示(日付ごとの一覧などで使う)
export function levelText(data) {
  if (data.level == null) return '';
  return `つらさ ${data.level}/${LEVEL_MAX}${data.levelName ? `「${data.levelName}」` : ''}`;
}

function levelHtml(data) {
  if (data.level == null) return '';
  const dots = LEVELS.slice(1).map((n) => `<i class="${n <= data.level ? 'on' : ''}"></i>`).join('');
  return `
    <div class="ws-row">
      <span class="ws-label">つらさ</span>
      <span class="ws-level"><strong>${data.level}</strong><small>/${LEVEL_MAX}</small>${data.levelName ? `<span class="ws-level-name">${esc(data.levelName)}</span>` : ''}</span>
      <span class="level-dots" aria-hidden="true">${dots}</span>
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
        ${levelHtml(r.data)}
        ${r.data.memo ? `<div class="ws-row"><span class="ws-label">詳細メモ</span><p class="view-text">${esc(r.data.memo)}</p></div>` : ''}
      </a>`).join('') : '<p class="empty">まだ書いていません</p>'}
  `;
}

export function renderWorksheetNew(el, params, isStale) {
  if (isStale()) return;
  return worksheetForm(el, null, isStale);
}

export async function renderWorksheetEdit(el, [id], isStale) {
  const rec = await get('records', id);
  if (isStale()) return;
  if (rec?.type !== 'worksheet') {
    el.innerHTML = notFoundHtml;
    return;
  }
  return worksheetForm(el, rec, isStale);
}

async function worksheetForm(el, rec, isStale) {
  const settings = await getSettings();
  if (isStale()) return;
  const initialAt = rec?.at ?? localDateTime();
  let level = rec?.data.level ?? null;
  // 直すときは、記録したときの名前を出す(いまの名前に変わらないように)
  const nameOf = (n) => (rec && n === rec.data.level ? rec.data.levelName ?? '' : levelName(settings, n));

  el.innerHTML = `
    <div class="card">
      <div class="field">
        <div class="field-label-row">
          <span class="field-label">つらさ</span>
          ${editLinkHtml(href('edit-levels'), '段階の名前を編集')}
        </div>
        <p class="small muted level-note">タップで選ぶ・もう一度タップで取り消し</p>
        <div class="level-list" role="group" aria-label="つらさ">
          ${LEVELS.map((n) => `
            <button type="button" class="level-btn" data-level="${n}" aria-pressed="${n === level}">
              <span class="level-num">${n}</span><span class="level-name">${esc(nameOf(n))}</span>
            </button>`).join('')}
        </div>
      </div>
      <label class="field">
        <span class="field-label">詳細メモ</span>
        <textarea class="input" name="memo" rows="6">${esc(rec?.data.memo ?? '')}</textarea>
      </label>
      <div class="mt-field">${datetimeField(initialAt)}</div>
    </div>
    <p class="hint">書けるところだけで保存できます。</p>
    ${formActionsHtml(rec)}
  `;

  const showLevel = () => el.querySelectorAll('.level-btn').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.level) === level)));
  el.querySelectorAll('.level-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const n = Number(b.dataset.level);
      level = level === n ? null : n;
      showLevel();
    });
  });

  // 下書き(新しく書くとき/直すときで別々)
  const fields = namedFields(el, ['memo', 'at']);
  const draft = await attachDraft({
    key: rec ? `worksheet:edit:${rec.id}` : 'worksheet:new',
    root: el,
    getState: () => ({ ...fields.get(), level }),
    setState(v) {
      fields.set(v);
      level = v.level ?? null;
      showLevel();
    },
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const memo = el.querySelector('[name="memo"]').value.trim();
    if (!memo && level == null) {
      toast('つらさを選ぶか、メモを書いてから保存してね');
      return;
    }
    const at = readAt(el, initialAt);
    const data = { level, levelName: level == null ? '' : nameOf(level), memo };
    if (rec) {
      rec.data = data;
      rec.at = at;
      await saveRecord(rec);
    } else {
      await saveRecord(newRecord('worksheet', data, at));
    }
    await draft.done();
    await leaveTo(href('worksheet'));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (!(await deleteRecordWithConfirm(rec))) return;
    await draft.done();
    await leaveTo(href('worksheet'));
  });

  return () => draft.dispose();
}

// ---- つらさの名前を変える ----

export async function renderEditLevels(el, params, isStale) {
  const settings = await getSettings();
  if (isStale()) return;
  const names = LEVELS.map((n) => `level${n}`);

  el.innerHTML = `
    <p class="hint hint-top">整理シートのつらさ 0〜10 に、自分の言葉で名前を付けられます。空欄の段階は数字だけ出ます。</p>
    <div class="card">
      ${LEVELS.map((n) => `
        <label class="level-name-row">
          <span class="level-num">${n}</span>
          <input type="text" class="input" name="level${n}" autocomplete="off" value="${esc(levelName(settings, n))}" aria-label="つらさ ${n} の名前">
        </label>`).join('')}
    </div>
    <p class="hint">名前を変えても、これまでの整理シートの記録はそのまま残ります。</p>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button>
      <button type="button" class="btn btn-block" id="reset-btn">はじめの名前にもどす</button>
    </div>
  `;

  const fields = namedFields(el, names);
  const draft = await attachDraft({ key: 'levels:edit', root: el, getState: fields.get, setState: fields.set });

  el.querySelector('#reset-btn').addEventListener('click', () => {
    fields.set(Object.fromEntries(names.map((k, i) => [k, DEFAULT_SETTINGS.levelNames[i]])));
    toast('はじめの名前を入れました。「保存する」で決まります');
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const v = fields.get();
    await setSetting('levelNames', names.map((k) => v[k].trim()));
    await draft.done();
    await leaveTo(href('worksheet-new'));
    toast('保存しました');
  });

  return () => draft.dispose();
}
