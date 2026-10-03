// 画面の共通部品(ヘッダー・お知らせ・確認ダイアログ)

import { APP_NAME } from './config.js';
import { esc } from './util.js';

const $ = (sel) => document.querySelector(sel);

export function setHeader({ title, isHome }) {
  $('#hdr-title').textContent = isHome ? APP_NAME : title;
  $('#hdr-back').hidden = isHome;
  $('#hdr-settings').hidden = !isHome;
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

// 確認ダイアログ。OK なら true を返す。
export function confirmDialog({ title, message, ok = 'OK', cancel = 'やめる', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="modal-title">${esc(title)}</h2>
        <div class="modal-body">${esc(message).replace(/\n/g, '<br>')}</div>
        <div class="modal-actions">
          <button type="button" class="btn" data-v="0">${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(ok)}</button>
        </div>
      </div>`;
    const close = (v) => {
      wrap.remove();
      resolve(v);
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return close(false);
      const v = e.target.closest('button')?.dataset.v;
      if (v != null) close(v === '1');
    });
    document.body.appendChild(wrap);
    wrap.querySelector('[data-v="1"]').focus();
  });
}

// 新しいバージョンのお知らせ
export function showUpdateBar(onApply) {
  const bar = $('#update-bar');
  bar.hidden = false;
  bar.querySelector('button').onclick = () => {
    bar.querySelector('button').disabled = true;
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
