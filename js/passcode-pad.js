// 4桁のパスコードを入れるテンキー(ロック画面と設定で使う)
// スマホのキーボードを出さずに、大きなボタンで入力する。PC ではキーボードの数字でも入力できる。

import { PASSCODE_LENGTH } from './lock.js';
import { esc } from './util.js';

export function padHtml({ title, message = '', bio = false }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', bio ? 'bio' : '', '0', 'del'];
  return `
    <div class="pc-pad">
      <p class="pc-title">${esc(title)}</p>
      <div class="pc-dots" aria-hidden="true">${'<i></i>'.repeat(PASSCODE_LENGTH)}</div>
      <p class="pc-msg" role="status" aria-live="polite">${esc(message)}</p>
      <div class="pc-keys">
        ${keys.map((k) => {
          if (k === '') return '<span></span>';
          if (k === 'del') return '<button type="button" class="pc-key pc-del" data-key="del" aria-label="1文字消す">⌫</button>';
          if (k === 'bio') return '<button type="button" class="pc-key pc-bio" data-key="bio" aria-label="指紋認証で開く">指紋</button>';
          return `<button type="button" class="pc-key" data-key="${k}">${k}</button>`;
        }).join('')}
      </div>
    </div>`;
}

// onComplete(code):4桁そろったとき。onBio():指紋ボタン
export function bindPad(root, { onComplete, onBio }) {
  let code = '';
  let disabled = false;
  const dots = root.querySelectorAll('.pc-dots i');
  const msg = root.querySelector('.pc-msg');
  const show = () => dots.forEach((d, i) => d.classList.toggle('on', i < code.length));

  const press = (key) => {
    if (key === 'bio') return onBio?.();
    if (disabled) return;
    if (key === 'del') code = code.slice(0, -1);
    else if (code.length < PASSCODE_LENGTH) code += key;
    show();
    if (code.length === PASSCODE_LENGTH) {
      const done = code;
      disabled = true; // 確かめている間は押せないように
      setTimeout(() => onComplete(done), 120); // 4つ目の丸が埋まるのを見せてから
    }
  };

  root.querySelector('.pc-keys').addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) press(b.dataset.key);
  });
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);

  return {
    clear() {
      code = '';
      disabled = false;
      show();
    },
    message(text) { msg.textContent = text; },
    disable(on) {
      disabled = on;
      root.querySelectorAll('.pc-key:not(.pc-bio)').forEach((b) => { b.disabled = on; });
    },
    shake() {
      const el = root.querySelector('.pc-dots');
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    },
    dispose() { document.removeEventListener('keydown', onKey); },
  };
}
