// 信号機(3-7)
// #/signal/<色> … 色をタップすると、その色の「どんな状態か」「何をするか」を大きく表示
// #/signal-edit/<色> … 書きかえる画面
// しんどいときに読む画面なので、色のタップ1回で読めるようにし、ほかの操作は下に小さく置く。
// 色を選んでも履歴は増やさない(戻る1回でホームへ戻れる)。

import { get, getAll, put } from '../db.js';
import { linesHtml, insertText, trackCursor, editLinkHtml, headRowHtml } from '../components.js';
import { href, leaveTo } from '../router.js';
import { attachDraft, namedFields } from '../drafts.js';
import { toast } from '../ui.js';
import { esc, nowIso } from '../util.js';

const COLORS = ['blue', 'yellow', 'red', 'black'];

export async function renderSignal(el, [color], isStale) {
  const signals = (await getAll('signals')).sort((a, b) => a.order - b.order);
  if (isStale()) return;
  const current = signals.find((s) => s.color === color);

  el.innerHTML = `
    <div class="signal-colors" role="group" aria-label="色をえらぶ">
      ${signals.map((s) => `
        <button type="button" class="sig-btn sig-${s.color}" data-color="${s.color}" aria-pressed="${s === current}">
          <span class="sig-name">${esc(s.name)}</span>
          <span class="sig-label">${esc(s.label)}</span>
        </button>`).join('')}
    </div>
    ${current ? `
      <section class="signal-detail sig-border-${current.color}" aria-live="polite">
        ${headRowHtml(
          `<h2 class="sig-title"><span class="sig-dot sig-${current.color}" aria-hidden="true"></span>${esc(current.name)}:${esc(current.label)}</h2>`,
          editLinkHtml(href('signal-edit', current.color), '書きかえる'),
        )}
        <h3 class="sig-head">どんな状態か</h3>
        <div class="sig-text">${(current.state ?? '').trim() ? linesHtml(current.state) : '<p class="sig-empty">まだ書いていません</p>'}</div>
        <h3 class="sig-head">何をするか</h3>
        <div class="sig-text">${(current.action ?? '').trim() ? linesHtml(current.action) : '<p class="sig-empty">まだ書いていません</p>'}</div>
      </section>
    ` :'<p class="hint sig-hint">色をタップすると、その色のメモが大きく出ます。</p>'}
  `;

  el.querySelectorAll('.sig-btn').forEach((b) => {
    b.addEventListener('click', () => location.replace(href('signal', b.dataset.color)));
  });
}

export async function renderSignalEdit(el, [color], isStale) {
  const sig = COLORS.includes(color) ? await get('signals', color) : null;
  if (isStale()) return;
  if (!sig) {
    el.innerHTML = '<div class="card"><p>見つかりませんでした。</p></div>';
    return;
  }

  const area = (name, label, value) => `
    <div class="field">
      <div class="field-label-row">
        <span class="field-label">${label}</span>
        <button type="button" class="btn btn-small bullet-btn" data-for="${name}">・を入れる</button>
      </div>
      <textarea class="input" name="${name}" rows="6" placeholder="1行ずつ書けます。「・」で始めると箇条書きになります">${esc(value)}</textarea>
    </div>`;

  el.innerHTML = `
    <div class="card sig-border-${sig.color}">
      <h2 class="sig-title"><span class="sig-dot sig-${sig.color}" aria-hidden="true"></span>${esc(sig.name)}</h2>
      <label class="field">
        <span class="field-label">この色の説明</span>
        <input type="text" class="input" name="label" value="${esc(sig.label)}" autocomplete="off">
      </label>
      ${area('state', 'どんな状態か', sig.state)}
      ${area('action', '何をするか', sig.action)}
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button>
    </div>
  `;

  el.querySelectorAll('textarea').forEach(trackCursor);
  el.querySelectorAll('.bullet-btn').forEach((b) => {
    b.addEventListener('click', () => insertText(el.querySelector(`[name="${b.dataset.for}"]`), '・'));
  });

  // 下書き(色ごと)
  const fields = namedFields(el, ['label', 'state', 'action']);
  const draft = await attachDraft({ key: `signal:edit:${sig.color}`, root: el, getState: fields.get, setState: fields.set });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const val = (n) => el.querySelector(`[name="${n}"]`).value;
    await put('signals', {
      ...sig,
      label: val('label').trim() || sig.label,
      state: val('state').replace(/\s+$/, ''),
      action: val('action').replace(/\s+$/, ''),
      updatedAt: nowIso(),
    });
    await draft.done();
    await leaveTo(href('signal', sig.color));
    toast('保存しました');
  });

  return () => draft.dispose();
}
