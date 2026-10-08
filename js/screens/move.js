// 引っ越しの画面(説明は docs/move.md)
// renderMoveOut … 古いアドレスのアプリ:ファイルを保存 → 新しいアプリを開いて記録を渡す
// renderMoveIn  … 新しいアドレスのアプリ:記録を受け取る。受け取れなければ「ファイルから読み込む」

import { NEW_URL, SITE, APP_NAME } from '../config.js';
import { makeBackupFile, markBackedUp, parseBackup, summarize } from '../backup.js';
import {
  serveMove, getMovedOut, markMovedByFile, skipMoveForNow, isDevOld, clearMovedOut,
  waitForOldApp, applyDirect, applyFile, getMovedIn, hasNoRecords,
} from '../move.js';
import { canPromptInstall, promptInstall } from '../pwa.js';
import { downloadBlob } from './backup.js';
import { confirmDialog, toast } from '../ui.js';
import { href, navigate, stopRouter } from '../router.js';
import { esc, formatDateTimeJa, isStandalone } from '../util.js';

const n = (counts) => counts?.records ?? 0;

// ---- 古いアプリ ----

export async function renderMoveOut(el, params, isStale) {
  if (SITE === 'new') return navigate('move-in');
  const moved = await getMovedOut();
  if (isStale()) return;
  if (moved && !isDevOld()) return enterMovedMode();

  el.innerHTML = `
    ${moved ? `
      <div class="card move-done">
        <p class="big-text">✓ 引っ越しは済んでいます</p>
        <p>${esc(formatDateTimeJa(new Date(moved.at)))}${moved.counts ? `(記録 ${n(moved.counts)}件)` : '(ファイルで移しました)'}</p>
        <p>これからは<strong>新しいアプリ</strong>を使ってください。</p>
        <a class="btn btn-primary btn-block" href="${esc(NEW_URL)}" target="_blank" rel="opener">新しいアプリを開く</a>
        <p class="hint">開発者用(?old-dev)で開いています。本人の画面では、この画面の代わりに案内だけの画面が出ます。</p>
      </div>` : `
      <div class="card">
        <p class="big-text">ゆる〜り日記は、新しい場所に引っ越します</p>
        <p>ほかのアプリと保存場所を分けて、記録がうっかり消えないようにするためです。記録はそのまま持っていけます。</p>
        <p class="small muted">こちらの記録は、引っ越したあともしばらく消さずに残しておきます。</p>
      </div>`}

    <section class="group">
      <h2 class="section-title">${moved ? 'もう一度引っ越すときは' : '引っ越しの手順'}</h2>
      <div class="card move-step">
        <p class="move-step-head">1. 引っ越し用のファイルを保存する</p>
        <p>念のため、先に記録をファイルにしておきます。</p>
        <button type="button" class="btn btn-primary btn-block" id="move-save">ファイルを保存する</button>
        <p class="move-saved" id="move-saved" hidden></p>
      </div>
      <div class="card move-step">
        <p class="move-step-head">2. 新しいアプリを開く</p>
        <p>新しいアプリが開いて、記録が自動で移ります。</p>
        <button type="button" class="btn btn-primary btn-block" id="move-open" disabled>新しいアプリを開く</button>
        <p class="move-status" id="move-status" role="status" hidden></p>
      </div>
      <div class="card move-step" id="move-file-card" hidden>
        <p class="move-step-head">自動で移らなかったときは</p>
        <p>新しいアプリの画面で「ファイルから読み込む」を押して、1. で保存したファイルを選んでください。</p>
        <p>読み込めたら、ここに戻って下のボタンを押してください。</p>
        <button type="button" class="btn btn-block" id="move-by-file">新しいアプリで読み込めた</button>
      </div>
    </section>

    ${moved
    ? '<button type="button" class="btn btn-ghost-danger btn-block mt-group" id="move-unmark">(開発者用)引っ越し済みの印を外す</button>'
    : '<button type="button" class="btn btn-block mt-group" id="move-skip">今は引っ越さずに使う</button>'}
  `;

  const saveBtn = el.querySelector('#move-save');
  const openBtn = el.querySelector('#move-open');
  const saved = el.querySelector('#move-saved');
  const status = el.querySelector('#move-status');
  const fileCard = el.querySelector('#move-file-card');
  let fileName = '';
  let stop = null;
  let fileTimer = null;

  const setStatus = (text, cls = '') => {
    status.textContent = text;
    status.className = `move-status ${cls}`;
    status.hidden = false;
  };

  saveBtn.addEventListener('click', async () => {
    try {
      const { blob, name } = await makeBackupFile();
      downloadBlob(blob, name);
      await markBackedUp();
      fileName = name;
      saved.textContent = `✓ 保存しました:${name}`;
      saved.hidden = false;
      openBtn.disabled = false;
    } catch (e) {
      console.error(e);
      toast('保存できませんでした');
    }
  });

  // window.open はボタンを押したその場で呼ぶ(あとからだと、開くのを止められることがある)
  openBtn.addEventListener('click', () => {
    stop?.();
    clearTimeout(fileTimer);
    const win = window.open(`${NEW_URL}#/move-in/${encodeURIComponent(fileName)}`, '_blank');
    if (!win) {
      setStatus('新しいアプリを開けませんでした。もう一度押してください。', 'is-error');
      return;
    }
    setStatus('新しいアプリを開いています…');
    // しばらくしても返事がなければ、ファイルで移す方法を出す(古いアプリの画面に戻ってきたときに見える)
    fileTimer = setTimeout(() => { if (!isStale()) fileCard.hidden = false; }, 8000);
    stop = serveMove(win, {
      onSent: () => setStatus('記録を渡しました。新しいアプリで確かめています…'),
      onDone: (m) => {
        clearTimeout(fileTimer);
        if (isStale()) return;
        setStatus(`✓ 引っ越しできました(記録 ${n(m.counts)}件)。新しいアプリを使ってください。`, 'is-ok');
        fileCard.hidden = true;
        // 済んだら、この古いアプリでは記録できないようにする(記録が新旧に分かれないように)
        if (!isDevOld()) enterMovedMode();
      },
      onFail: (msg) => {
        setStatus(`${msg}。下の「自動で移らなかったときは」の方法で移してください。`, 'is-error');
        fileCard.hidden = false;
      },
    });
  });

  el.querySelector('#move-by-file').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '新しいアプリで読み込めましたか?',
      message: '新しいアプリのホームや記録の画面で、記録が入っているのを確かめてから押してください。\n\nこちらの記録は消えません。',
      ok: '読み込めた',
    });
    if (!ok) return;
    await markMovedByFile();
    if (!isDevOld()) return enterMovedMode();
    if (!isStale()) renderMoveOut(el, params, isStale);
  });

  el.querySelector('#move-skip')?.addEventListener('click', () => {
    skipMoveForNow();
    location.replace('#/');
  });

  el.querySelector('#move-unmark')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '引っ越し済みの印を外しますか?',
      message: '外すと、このアプリはまた記録できるようになります(記録は変わりません)。\n本人の端末で使うと、記録が新旧に分かれるので気をつけてください。',
      ok: '外す',
      danger: true,
    });
    if (!ok) return;
    await clearMovedOut();
    toast('印を外しました');
    location.replace('#/');
  });

  return () => { stop?.(); clearTimeout(fileTimer); };
}

// ---- 引っ越しが済んだ古いアプリ:案内だけの画面 ----
// 記録の画面には行けないようにする(古いアイコンから開いて記録すると、記録が新旧2つに分かれるため)。
// できるのは「新しいアプリを開く」と「バックアップを書き出す」だけ。古い記録は予備として消さずに残す。

let movedMode = false;

export async function enterMovedMode() {
  if (movedMode) return;
  movedMode = true;
  stopRouter();
  document.querySelector('.modal-backdrop')?.remove();
  const $ = (sel) => document.querySelector(sel);
  $('#hdr-title').textContent = APP_NAME;
  $('#hdr-back').hidden = true;
  $('#hdr-settings').hidden = true;
  $('#hdr-help').hidden = true;
  document.title = APP_NAME;
  const el = $('#view');
  const moved = await getMovedOut();
  const android = /Android/.test(navigator.userAgent);
  el.innerHTML = `
    <div class="card move-done">
      <p class="big-text">✓ 新しいアプリに引っ越しました</p>
      ${moved ? `<p class="small">${esc(formatDateTimeJa(new Date(moved.at)))}${moved.counts ? `(記録 ${n(moved.counts)}件)` : ''}</p>` : ''}
      <p>記録は<strong>新しいアプリ</strong>でつけてください。こちらのアプリでは、もう記録できません。</p>
      <a class="btn btn-primary btn-block btn-big" href="${esc(NEW_URL)}" target="_blank" rel="opener">新しいアプリを開く</a>
    </div>

    <div class="card move-step">
      <p class="move-step-head">古いアイコンはホーム画面から外してね</p>
      <p>まちがえて開かないように、この古いアプリのアイコンはホーム画面から外してください。記録はしばらく残しておきます。</p>
      ${android ? '<p class="small muted">アイコンを長押しして、画面の上の「削除」まで動かします(「アンインストール」ではなく「削除」)。データを消すか聞かれたら、消さないでください。</p>' : ''}
    </div>

    <div class="card move-step">
      <p class="move-step-head">バックアップを書き出す</p>
      <p>こちらに残っている記録を、ファイルにして保存します。</p>
      <button type="button" class="btn btn-block" id="moved-export">バックアップを書き出す</button>
      <p class="move-saved" id="moved-saved" hidden></p>
    </div>
  `;
  window.scrollTo(0, 0);
  el.querySelector('#moved-export').addEventListener('click', async () => {
    try {
      const { blob, name } = await makeBackupFile();
      downloadBlob(blob, name);
      await markBackedUp();
      const p = el.querySelector('#moved-saved');
      p.textContent = `✓ 保存しました:${name}`;
      p.hidden = false;
    } catch (e) {
      console.error(e);
      toast('保存できませんでした');
    }
  });
}

// ---- 新しいアプリ ----

// params[0] … 古いアプリで保存したファイルの名前(探すときの目印。日時だけで、記録の中身は入っていない)
export async function renderMoveIn(el, params, isStale) {
  if (SITE === 'old') return navigate('move');
  const fileName = params[0] || '';
  const [movedIn, empty] = await Promise.all([getMovedIn(), hasNoRecords()]);
  if (isStale()) return;

  let stop = null;
  let fileTimer = null;
  const cleanup = () => { stop?.(); clearTimeout(fileTimer); };

  const showDone = (counts, info) => {
    cleanup();
    if (!isStale()) renderDone(el, counts, info);
  };

  el.innerHTML = `
    ${movedIn ? `
      <div class="card move-done">
        <p class="big-text">✓ 引っ越しは済んでいます</p>
        <p>${esc(formatDateTimeJa(new Date(movedIn.at)))}(記録 ${n(movedIn.counts)}件)</p>
      </div>` : ''}
    <div class="card move-wait" id="move-wait" hidden>
      <p class="big-text">古いアプリから記録を受け取っています…</p>
      <p class="muted small">このまま少し待ってください。</p>
    </div>
    <div id="move-file">
      <div class="card move-file">
        <p class="big-text" id="move-file-title">${movedIn ? 'もう一度ファイルから読み込むときは' : 'ファイルから記録を読み込みます'}</p>
        <p>古いアプリで保存した「引っ越し用のファイル」を選んでください。</p>
        <button type="button" class="btn btn-primary btn-block btn-big" id="move-pick">ファイルから読み込む</button>
        <input type="file" id="move-input" accept=".json,.txt,application/json,text/plain" hidden>
        <ol class="move-pick-help">
          <li>選ぶ画面の<strong>いちばん上</strong>(いちばん新しいもの)の<span class="nowrap">「yururi-diary-backup-…」</span>を選びます。</li>
          ${fileName ? `<li>名前は <strong class="move-fname">${esc(fileName)}</strong> です。</li>` : ''}
          <li>見つからないときは、選ぶ画面の左上の「≡」→「ダウンロード」を開きます。</li>
        </ol>
      </div>
    </div>
    ${movedIn ? `<a class="btn btn-block mt-group" href="${href('')}">ホームへ</a>` : ''}
  `;

  const wait = el.querySelector('#move-wait');
  const fileBox = el.querySelector('#move-file');
  const title = el.querySelector('#move-file-title');

  // 古いアプリから開かれていれば、まず直接受け取る。数秒たっても来なければ、ファイルの方法を大きく出す。
  stop = waitForOldApp(async (m, reply) => {
    clearTimeout(fileTimer);
    try {
      if (!(await hasNoRecords())) {
        const s = summarize(m.backup);
        const ok = await confirmDialog({
          title: '古いアプリの記録で置き換えますか?',
          message: `このアプリには、すでに記録が入っています。\n古いアプリの記録(${s.records}件)に置き換えます。\nいまの記録はとっておくので、「設定」→「バックアップ」の「読み込む前に戻す」で戻せます。`,
          ok: '置き換える',
          danger: true,
        });
        if (!ok) {
          reply({ ok: false, error: '新しいアプリで、置き換えるのをやめました' });
          return showFile('ファイルから記録を読み込みます');
        }
      }
      const counts = await applyDirect(m);
      reply({ ok: true, counts });
      showDone(counts, { how: 'direct', lock: !!m.meta?.find?.((r) => r.key === 'lock')?.value?.enabled, hadBio: !!m.hadBio });
    } catch (e) {
      console.error(e);
      reply({ ok: false, error: '新しいアプリで読み込めませんでした' });
      showFile('自動で受け取れませんでした。ファイルから読み込んでください');
    }
  });

  function showFile(text) {
    if (isStale()) return;
    wait.hidden = true;
    fileBox.hidden = false;
    if (text) title.textContent = text;
  }

  if (stop) {
    wait.hidden = false;
    fileBox.hidden = true;
    // 済んだあとに開き直したときは「受け取れませんでした」とは出さない
    fileTimer = setTimeout(() => showFile(movedIn ? null : '自動で受け取れませんでした。ファイルから読み込んでください'), 5000);
  } else if (!movedIn && !empty) {
    title.textContent = 'このアプリには、すでに記録が入っています';
  }

  const input = el.querySelector('#move-input');
  el.querySelector('#move-pick').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (e) {
      await confirmDialog({ title: '読み込めませんでした', message: e.message, ok: 'とじる', cancel: 'もどる' });
      return;
    }
    const s = summarize(backup);
    const ok = await confirmDialog({
      title: 'このファイルを読み込みますか?',
      message: `${s.exportedAt ? formatDateTimeJa(new Date(s.exportedAt)) : '日時不明'} に保存したファイル\n記録 ${s.records}件${await hasNoRecords() ? '' : '\n\nこのアプリにいま入っている記録は、このファイルの内容に置き換わります(あとから「読み込む前に戻す」で戻せます)。'}`,
      ok: '読み込む',
    });
    if (!ok) return;
    try {
      const counts = await applyFile(backup);
      showDone(counts, { how: 'file' });
    } catch (e) {
      console.error(e);
      toast('読み込めませんでした。もう一度ためしてください');
    }
  });

  return cleanup;
}

// 移せたあとの画面:ホーム画面への追加と、ロックの案内
function renderDone(el, counts, { how, lock = false, hadBio = false }) {
  const standalone = isStandalone();
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  el.innerHTML = `
    <div class="card move-done">
      <p class="big-text">✓ 引っ越しできました</p>
      <p>記録 ${n(counts)}件を移しました。</p>
    </div>

    <section class="group">
      <h2 class="section-title">このあと</h2>
      ${standalone ? '' : `
        <div class="card move-step">
          <p class="move-step-head">ホーム画面に追加する</p>
          ${canPromptInstall() ? `
            <button type="button" class="btn btn-primary btn-block" id="move-install">ホーム画面に追加</button>` : `
            <p>${ios
              ? '下の共有ボタン(□に↑)→「ホーム画面に追加」を押します。'
              : '右上の「⋮」→「ホーム画面に追加」(または「アプリをインストール」)を押します。見当たらないときは、先に「⋮」→「Chrome で開く」を押してから、もう一度「⋮」を開きます。'}</p>`}
          <p class="hint">これからは、新しく追加したアイコンから開いてください。古いアイコンは、しばらく残しておいてください。</p>
        </div>`}
      <div class="card move-step">
        <p class="move-step-head">ロック</p>
        <p>${how === 'direct'
          ? (lock
            ? `パスコードは、これまでと同じです。${hadBio ? '<br><strong>指紋</strong>は、「設定」→「ロック」から、もう一度登録してください。' : ''}`
            : 'ロックは使っていませんでした。使うときは「設定」→「ロック」からオンにできます。')
          : 'ファイルにはロックの設定が入っていないので、ロックはオフです。使っていたときは、「設定」→「ロック」からもう一度オンにしてください。'}</p>
      </div>
    </section>

    <a class="btn btn-primary btn-block mt-group" href="${href('')}">ホームへ</a>
  `;
  el.querySelector('#move-install')?.addEventListener('click', async () => {
    if (await promptInstall()) toast('ホーム画面に追加しました');
  });
}
