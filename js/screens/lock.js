// 設定 → ロック(3-11)
// オフのとき:説明・注意書き・バックアップのおすすめ → 「ロックをオンにする」
// オンにする流れ:パスコード(4桁)を2回 → 指紋認証を登録するか選ぶ(あとからでも登録・解除できる)
// オンのとき:指紋認証・ロックまでの時間・パスコードの変更・今すぐロック・オフにする
// 1つの画面の中で段階を切り替える(途中で戻っても、確定するまで何も保存しない)。

import { getMeta } from '../db.js';
import {
  getLock, setPasscode, verifyPasscode, disableLock, setTimeoutMin, bioAvailable, registerBio, removeBio,
  cryptoAvailable, waitLeft, LOCK_NOTE, TIMEOUT_OPTIONS, DEFAULT_TIMEOUT_MIN, FAILS_PER_WAIT,
} from '../lock.js';
import { padHtml, bindPad } from '../passcode-pad.js';
import { requireUnlock } from '../lock-screen.js';
import { href, navigate } from '../router.js';
import { confirmDialog, toast } from '../ui.js';
import { esc, formatDateTimeJa, daysSince } from '../util.js';

const noteHtml = `<div class="notice lock-warn"><span aria-hidden="true">⚠️</span><span>${esc(LOCK_NOTE)}</span></div>`;

export async function renderLockSettings(el, params, isStale) {
  const [lock0, canBio, lastBackupAt] = await Promise.all([getLock(), bioAvailable(), getMeta('lastBackupAt')]);
  if (isStale()) return;

  let lock = lock0;
  let step = 'main'; // main / new1 / new2 / verify / bio
  let purpose = null; // enable / change / disable
  let first = '';
  let message = '';
  let pad = null;

  const go = (next, msg = '') => {
    step = next;
    message = msg;
    draw();
  };

  const draw = () => {
    pad?.dispose();
    pad = null;
    if (!cryptoAvailable()) {
      el.innerHTML = '<div class="card"><p>この開き方ではロックを使えません。</p><p class="muted small">https のアドレス(GitHub Pages)で開くと使えます。</p></div>';
      return;
    }
    if (step === 'main') return lock.enabled ? drawOn() : drawOff();
    if (step === 'bio') return drawBioOffer();
    drawPad();
  };

  // ---- オフのとき ----
  const drawOff = () => {
    const lastText = lastBackupAt ? formatDateTimeJa(new Date(lastBackupAt)) : 'まだありません';
    el.innerHTML = `
      <div class="card">
        <p>アプリを開くときに、4桁のパスコード${canBio ? '(または指紋認証)' : ''}で開くようにします。</p>
        <p class="muted small">アプリから離れて、しばらくたって戻ったときもロックします。</p>
      </div>
      ${noteHtml}
      <section class="group">
        <h2 class="section-title">オンにする前に</h2>
        <div class="card">
          <p>バックアップを取っておくと、パスコードを忘れたときも記録を戻せるので安心です。</p>
          <p class="small muted">最後のバックアップ:${esc(lastText)}</p>
          <a class="btn btn-block" href="${href('backup')}">バックアップを取る</a>
        </div>
      </section>
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-block" id="enable-btn">ロックをオンにする</button>
      </div>`;
    el.querySelector('#enable-btn').addEventListener('click', async () => {
      // 今日バックアップを取っていなければ、やさしくすすめる(進むこともできる)
      if (!lastBackupAt || daysSince(lastBackupAt) > 0) {
        const toBackup = await confirmDialog({
          title: '先にバックアップを取りますか?',
          message: lastBackupAt
            ? `最後のバックアップは ${formatDateTimeJa(new Date(lastBackupAt))} です。\nパスコードを忘れたとき、バックアップがあれば記録を戻せます。`
            : 'まだバックアップを取っていません。\nパスコードを忘れたとき、バックアップがあれば記録を戻せます。',
          ok: 'バックアップへ',
          cancel: 'このまま進む',
        });
        if (toBackup) return navigate('backup');
      }
      purpose = 'enable';
      go('new1');
    });
  };

  // ---- オンのとき ----
  const drawOn = () => {
    const bioRow = !canBio
      ? '<div class="row"><span>指紋認証<br><span class="small muted">この端末では使えないため、パスコードだけで使えます</span></span></div>'
      : `<div class="row">
           <span>指紋認証<br><span class="small muted">${lock.credentialId ? '登録ずみ' : '登録していません'}</span></span>
           <button type="button" class="btn btn-small" id="bio-btn">${lock.credentialId ? '解除する' : '登録する'}</button>
         </div>`;
    el.innerHTML = `
      <div class="card rows">
        <div class="row"><span>ロック</span><span class="badge badge-on">オン</span></div>
        ${bioRow}
      </div>

      <section class="group">
        <h2 class="section-title">ロックまでの時間</h2>
        <div class="card">
          <div class="seg-row seg-row-5">
            ${TIMEOUT_OPTIONS.map((m) => `<button type="button" class="seg-btn" data-min="${m}" aria-pressed="${m === lock.timeoutMin}">${m}分</button>`).join('')}
          </div>
          <p class="small muted mt">アプリから離れて、この時間がたってから戻るとロックします(おすすめ:${DEFAULT_TIMEOUT_MIN}分)。アプリを開いたときは毎回ロックします。</p>
        </div>
      </section>

      <section class="group">
        <h2 class="section-title">パスコードをまちがえたとき</h2>
        <div class="card"><p class="small">${FAILS_PER_WAIT}回まちがえると30秒待ちます。続けてまちがえると1分、5分と少しずつ長くなります(最長5分)。待てばまた入力できるので、開けなくなることはありません。指紋認証は待っている間も使えます。</p></div>
      </section>

      ${noteHtml}

      <div class="form-actions">
        <button type="button" class="btn btn-block" id="lock-now">今すぐロックする</button>
        <button type="button" class="btn btn-block" id="change-btn">パスコードを変える</button>
        <button type="button" class="btn btn-ghost-danger btn-block" id="disable-btn">ロックをオフにする</button>
      </div>`;

    el.querySelectorAll('[data-min]').forEach((b) => {
      b.addEventListener('click', async () => {
        lock = await setTimeoutMin(Number(b.dataset.min));
        toast(`${b.dataset.min}分にしました`);
        draw();
      });
    });
    el.querySelector('#bio-btn')?.addEventListener('click', async () => {
      if (lock.credentialId) {
        if (!(await confirmDialog({ title: '指紋認証を解除しますか?', message: 'これからはパスコードだけで開きます。あとで、また登録できます。', ok: '解除する' }))) return;
        lock = await removeBio();
        toast('指紋認証を解除しました');
        return draw();
      }
      await doRegisterBio();
      draw();
    });
    el.querySelector('#lock-now').addEventListener('click', () => requireUnlock({ autoBio: false }));
    el.querySelector('#change-btn').addEventListener('click', async () => { lock = await getLock(); purpose = 'change'; go('verify'); });
    el.querySelector('#disable-btn').addEventListener('click', async () => { lock = await getLock(); purpose = 'disable'; go('verify'); });
  };

  const doRegisterBio = async () => {
    try {
      lock = await registerBio();
      toast('指紋認証を登録しました');
      return true;
    } catch (e) {
      console.warn(e);
      toast('登録できませんでした。パスコードで使えます');
      return false;
    }
  };

  // ---- 指紋認証を登録するか(オンにした直後) ----
  const drawBioOffer = () => {
    el.innerHTML = `
      <div class="card">
        <p class="big-text">ロックをオンにしました</p>
        <p>指紋認証も使いますか?<br>登録すると、指紋でも開けるようになります(パスコードでも開けます)。</p>
        <p class="small muted">あとで、設定のロックから登録・解除できます。</p>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-block" id="bio-yes">指紋認証を登録する</button>
        <button type="button" class="btn btn-block" id="bio-no">あとで(パスコードだけ使う)</button>
      </div>`;
    el.querySelector('#bio-yes').addEventListener('click', async () => {
      await doRegisterBio();
      go('main');
    });
    el.querySelector('#bio-no').addEventListener('click', () => go('main'));
  };

  // ---- パスコードの入力(新しく決める・確かめる) ----
  const drawPad = () => {
    const titles = {
      new1: purpose === 'change' ? '新しいパスコード(4桁)を入力してください' : 'パスコード(4桁)を決めて入力してください',
      new2: '確認のため、もう一度入力してください',
      verify: 'いまのパスコードを入力してください',
    };
    const stepLabel = step === 'verify' ? '' : `<p class="step-label">${step === 'new1' ? '1' : '2'} / 2</p>`;
    el.innerHTML = `
      <div class="card lock-setup">
        ${stepLabel}
        ${padHtml({ title: titles[step], message })}
      </div>
      ${step === 'verify' ? '' : noteHtml}
      <div class="form-actions"><button type="button" class="btn btn-block" id="cancel-btn">やめる</button></div>`;
    el.querySelector('#cancel-btn').addEventListener('click', () => go('main'));

    pad = bindPad(el, {
      async onComplete(code) {
        if (step === 'new1') {
          first = code;
          return go('new2');
        }
        if (step === 'new2') {
          if (code !== first) {
            first = '';
            return go('new1', '2回の入力が一致しませんでした。はじめから入力してください');
          }
          lock = await setPasscode(code);
          first = '';
          if (purpose === 'change') {
            toast('パスコードを変えました');
            return go('main');
          }
          if (canBio) return go('bio');
          toast('ロックをオンにしました');
          return go('main');
        }
        // verify
        const r = await verifyPasscode(code);
        if (!r.ok) {
          pad.shake();
          pad.clear();
          if (r.waitMs > 0) {
            pad.disable(true);
            pad.message(`まちがいが続いたので、${Math.ceil(r.waitMs / 1000)}秒ほど待ってから入力してください`);
            setTimeout(() => { if (pad) { pad.disable(false); pad.message(''); } }, r.waitMs);
          } else {
            pad.message('パスコードがちがいます');
          }
          return;
        }
        if (purpose === 'disable') {
          lock = await disableLock();
          toast('ロックをオフにしました');
          return go('main');
        }
        go('new1'); // change
      },
    });

    const left = step === 'verify' ? waitLeft(lock) : 0;
    if (left > 0) {
      pad.disable(true);
      pad.message(`まちがいが続いたので、${Math.ceil(left / 1000)}秒ほど待ってから入力してください`);
      setTimeout(() => { if (pad) { pad.disable(false); pad.message(''); } }, left);
    }
  };

  draw();
  return () => pad?.dispose();
}
