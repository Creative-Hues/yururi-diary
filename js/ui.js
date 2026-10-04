// 画面の共通部品(ヘッダー・お知らせ・確認ダイアログ)

import { APP_NAME } from './config.js';
import { esc } from './util.js';

const $ = (sel) => document.querySelector(sel);

export function setHeader({ title, isHome }) {
  $('#hdr-title').textContent = isHome ? APP_NAME : title;
  $('#hdr-back').hidden = isHome;
  $('#hdr-settings').hidden = !isHome;
  $('#hdr-help').hidden = !isHome;
  document.title = isHome ? APP_NAME : `${title} - ${APP_NAME}`;
}

let toastTimer;
export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ダイアログ。押したボタンの value(背景・戻る操作で閉じたら null)と、中身の要素を返す。
// body は HTML。validate(value, el) がエラー文を返したら、トーストを出して閉じない。
// Android の「戻る」でページではなくダイアログが閉じるよう、開くときに履歴を1つ積む。
// sheet: true で画面の下から出る形(押しつけ感を減らしたいお知らせ用)
export function openDialog({ title, body = '', buttons, onMount, validate, sheet = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = `modal-backdrop${sheet ? ' sheet' : ''}`;
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="modal-title">${esc(title)}</h2>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls ?? ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
      </div>`;
    const dlg = wrap.querySelector('.modal');
    let closed = false;

    const onPop = () => close(null, true);
    const close = (value, byBack = false) => {
      if (closed) return;
      closed = true;
      wrap.remove();
      window.removeEventListener('popstate', onPop);
      if (byBack) return resolve({ value, el: dlg });
      // 積んだ履歴を戻してから知らせる(続けて画面移動しても順番が崩れないように)
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve({ value, el: dlg });
      };
      window.addEventListener('popstate', done, { once: true });
      setTimeout(done, 600);
      history.back();
    };

    history.pushState({ modal: true }, '');
    window.addEventListener('popstate', onPop);
    wrap.addEventListener('click', async (e) => {
      if (e.target === wrap) return close(null);
      // 下のボタンのほか、body の中の data-value を持つ要素も押せる
      const btn = e.target.closest('button[data-i], [data-value]');
      if (!btn) return;
      const value = btn.dataset.value ?? buttons[Number(btn.dataset.i)].value ?? null;
      if (value && validate) {
        const err = await validate(value, dlg);
        if (err) return toast(err);
      }
      close(value);
    });
    document.body.appendChild(wrap);
    onMount?.(dlg);
  });
}

// 確認ダイアログ。OK なら true を返す。
export async function confirmDialog({ title, message, ok = 'OK', cancel = 'やめる', danger = false }) {
  const { value } = await openDialog({
    title,
    body: esc(message).replace(/\n/g, '<br>'),
    buttons: [{ label: cancel }, { label: ok, value: 'ok', cls: danger ? 'btn-danger' : 'btn-primary' }],
  });
  return value === 'ok';
}

// 新しいバージョンのお知らせ
// 「バックアップ」はバックアップの画面を開くだけ(お知らせは画面の外にあるので、取ったあとも残り、そのまま「更新する」を押せる)
export function showUpdateBar(onApply) {
  const bar = $('#update-bar');
  bar.hidden = false;
  const apply = $('#update-apply');
  apply.onclick = () => {
    apply.disabled = true;
    onApply();
  };
}

export function showFatal(message) {
  $('#view').innerHTML = `
    <div class="card fatal">
      <p class="fatal-title">うまく開けませんでした</p>
      <p>${esc(message)}</p>
      <p class="muted small">バージョン ${esc(self.APP_VERSION)}</p>
    </div>`;
}
