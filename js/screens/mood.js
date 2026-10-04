// 気分の記録(3-1)
// #/mood … 気分を記録する(ボタンには本人が選んだ絵文字も出す)
// #/edit-mood-emoji … 気分の絵文字を変える

import { getRecordsByType, newRecord, saveRecord } from '../db.js';
import { MOODS, TOUGH_MOODS, moodLabel } from '../constants.js';
import { recItem, sortByAt, timeOf, editLinkHtml, headRowHtml } from '../components.js';
import { editRecordDialog } from '../record-dialog.js';
import { onToughMood } from '../support.js';
import { getSettings, setSetting, moodEmoji } from '../prefs.js';
import { href, leaveTo } from '../router.js';
import { attachDraft, namedFields } from '../drafts.js';
import { toast } from '../ui.js';
import { dateKey, esc } from '../util.js';

export async function renderMood(el, params, isStale) {
  const today = dateKey();
  const [rows, settings] = await Promise.all([getRecordsByType('mood', today, today).then(sortByAt), getSettings()]);
  if (isStale()) return;
  const rerender = () => renderMood(el, params, isStale);

  el.innerHTML = `
    ${headRowHtml('<p class="lead">いまの気分は?</p>', editLinkHtml(href('edit-mood-emoji'), '絵文字を編集'))}
    <div class="mood-list">
      ${MOODS.map((m) => `<button type="button" class="mood-btn" data-level="${m.level}"><span class="mood-emoji" aria-hidden="true">${esc(moodEmoji(settings, m.level))}</span><span>${esc(m.label)}</span></button>`).join('')}
    </div>
    <p class="hint">タップすると、いまの時刻で記録します。時刻はあとから直せます。</p>

    <section class="group">
      <h2 class="section-title">今日の気分</h2>
      ${rows.length
        ? `<div class="card rows">${rows.map((r) => recItem({ id: r.id, time: timeOf(r.at), main: `${esc(moodEmoji(settings, r.data.level))} ${esc(moodLabel(r.data.level))}` })).join('')}</div>`
        : '<p class="empty">まだ記録はありません</p>'}
    </section>
  `;

  el.querySelectorAll('.mood-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      el.querySelectorAll('.mood-btn').forEach((x) => { x.disabled = true; }); // 二重タップ防止
      const { level } = b.dataset;
      await saveRecord(newRecord('mood', { level }));
      await rerender();
      // しんどいときは下から出るお知らせの見出しで「記録しました」を伝える(トーストがボタンに重ならないように)
      if (TOUGH_MOODS.includes(level)) onToughMood(level);
      else toast(`「${moodLabel(level)}」を記録しました`);
    });
  });

  el.querySelectorAll('.rec-item').forEach((b) => {
    b.addEventListener('click', async () => {
      if (await editMood(rows.find((r) => r.id === b.dataset.id))) rerender();
    });
  });
}

// 気分を直す・削除するダイアログ(カレンダーの日付ごとの一覧からも使う)。変えたら true
export async function editMood(rec) {
  let level = rec.data.level;
  const settings = await getSettings();
  return editRecordDialog({
    title: '気分を直す',
    rec,
    body: `<div class="seg-list">${MOODS.map((m) => `<button type="button" class="seg-btn" data-level="${m.level}" aria-pressed="${m.level === level}">${esc(moodEmoji(settings, m.level))} ${esc(m.label)}</button>`).join('')}</div>`,
    onMount(d) {
      d.querySelectorAll('.seg-btn').forEach((s) => {
        s.addEventListener('click', () => {
          level = s.dataset.level;
          d.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
        });
      });
    },
    apply() { rec.data.level = level; },
  });
}

// ---- 気分の絵文字を変える(#/edit-mood-emoji) ----
// 1つの絵文字だけを残す(2文字以上入れたら最初の1つ)。空欄にすると、はじめの絵文字にもどる。

function firstEmoji(s) {
  const t = s.trim();
  if (!t) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(t)[Symbol.iterator]().next().value?.segment ?? '';
  }
  return [...t][0];
}

export async function renderEditMoodEmoji(el, params, isStale) {
  const settings = await getSettings();
  if (isStale()) return;

  el.innerHTML = `
    <p class="hint hint-top">気分を記録するボタンと、カレンダーに出る絵文字です。好きな絵文字に変えられます(空欄にすると、はじめの絵文字にもどります)。</p>
    <div class="card">
      ${MOODS.map((m) => `
        <label class="emoji-row">
          <span class="emoji-label">${esc(m.label)}</span>
          <input type="text" class="input emoji-input" name="${m.level}" autocomplete="off" value="${esc(moodEmoji(settings, m.level))}" aria-label="${esc(m.label)}の絵文字">
          <span class="small muted">はじめは ${m.emoji}</span>
        </label>`).join('')}
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button>
    </div>
  `;

  const fields = namedFields(el, MOODS.map((m) => m.level));
  const draft = await attachDraft({ key: 'mood-emoji:edit', root: el, getState: fields.get, setState: fields.set });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const v = fields.get();
    const emojis = {};
    for (const m of MOODS) {
      const e = firstEmoji(v[m.level]);
      if (e && e !== m.emoji) emojis[m.level] = e;
    }
    await setSetting('moodEmojis', emojis);
    await draft.done();
    await leaveTo(href('settings'));
    toast('保存しました');
  });

  return () => draft.dispose();
}
