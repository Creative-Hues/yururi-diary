// 相談したいことメモ(3-8)
// #/consult/<タグのid>                      … 見る画面(未相談・相談済み)。タグのidがあれば、そのタグのメモだけ
// #/consult-new                             … 書く画面
// #/consult-edit/<id>                       … 直す画面(相談済みの切り替え・削除も)
// #/consult-comment-new/<id>                … 相談後のメモを書く画面
// #/consult-comment-edit/<id>/<コメントのid> … 相談後のメモを直す画面
// タグ(誰に向けたメモか)は choices の 'consult.tag'。メモには id だけを持つので、名前を変えるとすべてのメモの表示が変わる。
// 相談後のメモ(comments)を書いても、相談済みにはしない(「✓ 相談した」で切り替える)。

import { get, getAll, put, del } from '../db.js';
import { getChoices } from '../choices.js';
import { LISTS } from '../constants.js';
import { datetimeField, readAt, formActionsHtml, notFoundHtml, timeOf, editLinkHtml, headRowHtml } from '../components.js';
import { href, leaveTo } from '../router.js';
import { attachDraft, namedFields } from '../drafts.js';
import { confirmDialog, toast } from '../ui.js';
import { esc, localDateTime, nowIso, uuid, formatDateJa, parseLocalDateTime } from '../util.js';

const dateLabel = (at) => formatDateJa(parseLocalDateTime(at));

// メモに付いているタグの名前(消したタグは出さない。並びはタグの一覧の順)
export function consultTagLabels(consult, tags) {
  const ids = new Set(consult.tags ?? []);
  return tags.filter((t) => ids.has(t.id)).map((t) => t.label);
}

export const sortComments = (comments) => [...(comments ?? [])].sort((a, b) => a.at.localeCompare(b.at));

const tagsHtml = (labels) => (labels.length ? `<span class="tag-list">${labels.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}</span>` : '');

export async function renderConsult(el, [tagId], isStale) {
  const [all, tags] = await Promise.all([getAll('consults'), getChoices(LISTS.consultTag)]);
  if (isStale()) return;
  const filter = tags.find((t) => t.id === tagId) ?? null;
  const rows = all
    .filter((r) => !filter || (r.tags ?? []).includes(filter.id))
    .sort((a, b) => a.at.localeCompare(b.at));
  const open = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const card = (r) => `
    <div class="card consult-card${r.done ? ' is-done' : ''}" data-id="${esc(r.id)}">
      <div class="consult-top">
        <a class="consult-main" href="${href('consult-edit', r.id)}">
          ${tagsHtml(consultTagLabels(r, tags))}
          <p class="view-text">${esc(r.text)}</p>
          <span class="small muted">${dateLabel(r.at)}に書いたメモ${r.done && r.doneAt ? `・${formatDateJa(new Date(r.doneAt))}に相談済み` : ''}</span>
        </a>
        <button type="button" class="check-btn" data-act="toggle" aria-pressed="${!!r.done}">${r.done ? '未相談にもどす' : '✓ 相談した'}</button>
      </div>
      <div class="comments">
        ${sortComments(r.comments).map((c) => `
          <a class="comment" href="${href('consult-comment-edit', r.id, c.id)}">
            <span class="comment-head">相談後のメモ・${dateLabel(c.at)} ${timeOf(c.at)}<span class="chev" aria-hidden="true">›</span></span>
            <span class="comment-text">${esc(c.text)}</span>
          </a>`).join('')}
        <a class="comment-add" href="${href('consult-comment-new', r.id)}">＋ 相談後のメモを書く</a>
      </div>
    </div>`;

  el.innerHTML = `
    <a class="btn btn-primary btn-block add-btn" href="${href('consult-new')}">＋ 書く</a>
    ${headRowHtml(`<span class="section-title">${tags.length ? 'タグでしぼりこむ' : 'タグ(誰に向けたメモか)'}</span>`, editLinkHtml(href('edit-consult-tags'), 'タグを編集'))}
    ${tags.length ? `
      <div class="filter-chips" role="group" aria-label="タグでしぼりこむ">
        <button type="button" class="filter-chip" data-tag="" aria-pressed="${!filter}">すべて</button>
        ${tags.map((t) => `<button type="button" class="filter-chip" data-tag="${esc(t.id)}" aria-pressed="${t === filter}">${esc(t.label)}</button>`).join('')}
      </div>` : ''}
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

  el.querySelectorAll('[data-tag]').forEach((b) => {
    b.addEventListener('click', () => location.replace(b.dataset.tag ? href('consult', b.dataset.tag) : href('consult')));
  });

  el.querySelectorAll('[data-act="toggle"]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = rows.find((x) => x.id === b.closest('[data-id]').dataset.id);
      await setDone(r, !r.done);
      toast(r.done ? '相談済みにしました' : '未相談にもどしました');
      renderConsult(el, [tagId], isStale);
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
  return consultForm(el, null, isStale);
}

export async function renderConsultEdit(el, [id], isStale) {
  const rec = await get('consults', id);
  if (isStale()) return;
  if (!rec) {
    el.innerHTML = notFoundHtml;
    return;
  }
  return consultForm(el, rec, isStale);
}

async function consultForm(el, rec, isStale) {
  const tags = await getChoices(LISTS.consultTag);
  if (isStale()) return;
  const initialAt = rec?.at ?? localDateTime();
  const selected = new Set(rec?.tags ?? []);
  el.innerHTML = `
    <div class="card">
      <label class="field">
        <span class="field-label">診察やスタッフさんに相談したいこと</span>
        <textarea class="input" name="text" rows="6">${esc(rec?.text ?? '')}</textarea>
      </label>
      <div class="field">
        <div class="field-label-row">
          <span class="field-label">誰に相談したいか(いくつでも選べます)</span>
          ${editLinkHtml(href('edit-consult-tags'), 'タグを編集')}
        </div>
        ${tags.length
          ? `<div class="chips" data-group="tags">${tags.map((t) => `<button type="button" class="chip" data-id="${esc(t.id)}" aria-pressed="${selected.has(t.id)}">${esc(t.label)}</button>`).join('')}</div>`
          : '<p class="small muted">タグはまだありません。「タグを編集」から追加できます。</p>'}
      </div>
      <label class="check-row">
        <input type="checkbox" name="done" ${rec?.done ? 'checked' : ''}>
        <span>相談済み</span>
      </label>
      <div class="mt-field">${datetimeField(initialAt, '書いた日時')}</div>
    </div>
    ${formActionsHtml(rec)}
  `;

  const chips = [...el.querySelectorAll('[data-group="tags"] .chip')];
  chips.forEach((c) => {
    c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')));
  });
  const readTags = () => chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.id);

  // 下書き(新しく書くとき/直すときで別々)
  const fields = namedFields(el, ['text', 'done', 'at']);
  const draft = await attachDraft({
    key: rec ? `consult:edit:${rec.id}` : 'consult:new',
    root: el,
    getState: () => ({ ...fields.get(), tags: readTags() }),
    setState(v) {
      fields.set(v);
      const ids = new Set(v.tags ?? []);
      chips.forEach((c) => c.setAttribute('aria-pressed', String(ids.has(c.dataset.id))));
    },
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const text = el.querySelector('[name="text"]').value.trim();
    if (!text) {
      toast('相談したいことを書いてね');
      return;
    }
    const done = el.querySelector('[name="done"]').checked;
    const t = nowIso();
    const row = rec ?? { id: uuid(), createdAt: t, done: 0, doneAt: null, comments: [] };
    row.text = text;
    // いまは一覧にない(消した)タグは外す
    row.tags = readTags();
    row.at = readAt(el, initialAt);
    row.updatedAt = t;
    if (!!row.done !== done) {
      row.done = done ? 1 : 0;
      row.doneAt = done ? t : null;
    }
    await put('consults', row);
    await draft.done();
    await leaveTo(href('consult'));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'このメモを削除しますか?', message: '相談後のメモも一緒に消えます。削除すると、もとに戻せません。', ok: '削除する', danger: true });
    if (!ok) return;
    await del('consults', rec.id);
    toast('削除しました');
    await draft.done();
    await leaveTo(href('consult'));
  });

  return () => draft.dispose();
}

// ---- 相談後のメモ ----

export async function renderCommentNew(el, [id], isStale) {
  const consult = await get('consults', id);
  if (isStale()) return;
  if (!consult) {
    el.innerHTML = notFoundHtml;
    return;
  }
  return commentForm(el, consult, null);
}

export async function renderCommentEdit(el, [id, commentId], isStale) {
  const consult = await get('consults', id);
  if (isStale()) return;
  const comment = consult?.comments?.find((c) => c.id === commentId);
  if (!comment) {
    el.innerHTML = notFoundHtml;
    return;
  }
  return commentForm(el, consult, comment);
}

async function commentForm(el, consult, comment) {
  const initialAt = comment?.at ?? localDateTime();
  el.innerHTML = `
    <div class="card consult-quote">
      <span class="field-label">相談したかったこと</span>
      <p class="view-text clamp">${esc(consult.text)}</p>
    </div>
    <div class="card mt-group">
      <label class="field">
        <span class="field-label">相談後のメモ(言われたこと・決まったこと・思ったことなど)</span>
        <textarea class="input" name="text" rows="6">${esc(comment?.text ?? '')}</textarea>
      </label>
      <div class="mt-field">${datetimeField(initialAt)}</div>
    </div>
    <p class="hint">書いても「相談済み」にはなりません。済んだら一覧の「✓ 相談した」を押してね。</p>
    ${formActionsHtml(comment)}
  `;
  if (comment) el.querySelector('#delete-btn').textContent = 'この相談後のメモを削除';

  const fields = namedFields(el, ['text', 'at']);
  const draft = await attachDraft({
    key: comment ? `consult-comment:edit:${comment.id}` : `consult-comment:new:${consult.id}`,
    root: el,
    getState: fields.get,
    setState: fields.set,
  });

  // 保存する直前に読み直す(ほかの画面での変更を消さないように)
  const update = async (fn) => {
    const fresh = (await get('consults', consult.id)) ?? consult;
    fresh.comments = fn(fresh.comments ?? []);
    fresh.updatedAt = nowIso();
    await put('consults', fresh);
  };

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const text = el.querySelector('[name="text"]').value.trim();
    if (!text) {
      toast('相談後のメモを書いてね');
      return;
    }
    const t = nowIso();
    const at = readAt(el, initialAt);
    await update((list) => (comment
      ? list.map((c) => (c.id === comment.id ? { ...c, text, at, updatedAt: t } : c))
      : [...list, { id: uuid(), text, at, createdAt: t, updatedAt: t }]));
    await draft.done();
    await leaveTo(href('consult'));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'この相談後のメモを削除しますか?', message: '削除すると、もとに戻せません。', ok: '削除する', danger: true });
    if (!ok) return;
    await update((list) => list.filter((c) => c.id !== comment.id));
    toast('削除しました');
    await draft.done();
    await leaveTo(href('consult'));
  });

  return () => draft.dispose();
}
