// ロック画面
// ・アプリを開いたとき(起動時)
// ・アプリから離れて、設定した時間(初期5分)以上たって戻ったとき
// 画面全体を覆い、後ろの画面は操作できないようにする(inert)。

import { getLock, verifyPasscode, verifyBio, waitLeft, LOCK_NOTE, FAILS_PER_WAIT } from './lock.js';
import { padHtml, bindPad } from './passcode-pad.js';
import { APP_NAME } from './config.js';
import { FORGOT_GUIDE_HTML } from './forgot-guide.js';
import { esc } from './util.js';

let showing = null; // 表示中なら、ロックが外れたときに解決する Promise
let hiddenAt = null;

const waitText = (ms) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}分${s % 60 ? `${s % 60}秒` : ''}` : `${s}秒`;
};

export const isLocked = () => showing !== null;

// ロックがオンならロック画面を出し、開けるまで待つ
export async function requireUnlock({ autoBio = true } = {}) {
  if (showing) return showing;
  const lock = await getLock();
  if (!lock.enabled) return;
  showing = show(lock, autoBio).finally(() => { showing = null; });
  return showing;
}

function show(lock, autoBio) {
  return new Promise((resolve) => {
    const app = document.querySelector('.app');
    app.inert = true;
    const hasBio = !!lock.credentialId;
    const wrap = document.createElement('div');
    wrap.className = 'lock-screen';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'ロック');
    wrap.innerHTML = `
      <div class="lock-inner lock-main">
        <div class="lock-brand"><img src="icons/icon.svg" alt="" width="56" height="56"><span>${esc(APP_NAME)}</span></div>
        ${padHtml({ title: 'パスコードを入力してください', bio: hasBio })}
        <p class="lock-note">${esc(LOCK_NOTE)}</p>
        <button type="button" class="text-link lock-forgot" id="forgot-open">パスコードを忘れたら</button>
      </div>
      <div class="lock-inner lock-guide" hidden>
        ${FORGOT_GUIDE_HTML}
        <button type="button" class="btn btn-primary btn-block" id="forgot-close">パスコードの入力にもどる</button>
      </div>`;
    // 「パスコードを忘れたら」の案内(ロック画面の中で切り替える)
    const main = wrap.querySelector('.lock-main');
    const guide = wrap.querySelector('.lock-guide');
    wrap.querySelector('#forgot-open').addEventListener('click', () => {
      main.hidden = true;
      guide.hidden = false;
      wrap.scrollTop = 0;
    });
    wrap.querySelector('#forgot-close').addEventListener('click', () => {
      guide.hidden = true;
      main.hidden = false;
      wrap.scrollTop = 0;
    });
    document.body.appendChild(wrap);

    let timer = null;
    const unlock = () => {
      clearInterval(timer);
      pad.dispose();
      wrap.remove();
      app.inert = false;
      resolve();
    };

    // まちがいが続いたときの待ち時間(指紋はその間も使える)
    const startWait = (ms) => {
      pad.disable(true);
      const end = Date.now() + ms;
      const tick = () => {
        const left = end - Date.now();
        if (left <= 0) {
          clearInterval(timer);
          pad.disable(false);
          pad.clear();
          pad.message('もう一度入力してください');
          return;
        }
        pad.message(`まちがいが続いたので、${waitText(left)}待ってから入力してください`);
      };
      tick();
      clearInterval(timer);
      timer = setInterval(tick, 500);
    };

    const tryBio = async () => {
      try {
        if (await verifyBio()) return unlock();
        pad.message('指紋認証が通りませんでした。パスコードで開けます');
      } catch {
        pad.message('指紋認証が使えませんでした。パスコードで開けます');
      }
    };

    const pad = bindPad(wrap, {
      async onComplete(code) {
        const r = await verifyPasscode(code);
        if (r.ok) return unlock();
        pad.shake();
        pad.clear();
        if (r.waitMs > 0) startWait(r.waitMs);
        else pad.message(r.untilWait < FAILS_PER_WAIT ? `パスコードがちがいます(あと${r.untilWait}回まちがえると、少し待つことになります)` : 'パスコードがちがいます');
      },
      onBio: hasBio ? tryBio : null,
    });

    const left = waitLeft(lock);
    if (left > 0) startWait(left);
    // 指紋が登録されていれば、すぐに指紋の確認を出す(Pixel では自動で出る。iPhone ではボタンを押す必要があることがある)
    if (hasBio && autoBio) tryBio();
  });
}

// アプリから離れた時間を見て、戻ったときにロックする
export function watchAway() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      if (!showing) hiddenAt = Date.now();
      return;
    }
    if (hiddenAt == null) return;
    const away = Date.now() - hiddenAt;
    hiddenAt = null;
    const lock = await getLock();
    if (lock.enabled && away >= lock.timeoutMin * 60000) requireUnlock();
  });
}
