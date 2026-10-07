// バックアップ画面

import { getMeta } from '../db.js';
import { makeBackupFile, markBackedUp, parseBackup, restoreBackup, summarize, getImportUndo, undoImport } from '../backup.js';
import { confirmDialog, toast } from '../ui.js';
import { navigate } from '../router.js';
import { esc, formatDateTimeJa, daysSince } from '../util.js';

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// 共有は .txt(text/plain)で行う。Android の Chrome は .json を共有に渡せないが、.txt なら渡せる。
// iPhone でも同じ形にして、リハーサルで本番(Pixel)と同じファイルになるようにしている。
function canShareText() {
  try {
    const f = new File(['{}'], 'test.txt', { type: 'text/plain' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

// Chrome は、ボタンを押してから時間がたつと共有の画面を出せない(NotAllowedError)。
// そのときは作ったファイルを取っておき、もう一度押してもらったときにすぐ渡す。
let pendingShare = null; // { file, at }

export async function renderBackup(el, params, isStale) {
  const [last, undo] = await Promise.all([getMeta('lastBackupAt'), getImportUndo()]);
  if (isStale()) return;

  const days = last ? daysSince(last) : null;
  const lastText = last ? `${formatDateTimeJa(new Date(last))}(${days === 0 ? '今日' : `${days}日前`})` : 'まだありません';
  const share = canShareText();

  el.innerHTML = `
    <div class="card backup-last${days === 0 ? ' is-today' : ''}">
      <p class="muted small">最後のバックアップ</p>
      <p class="big-text">${esc(lastText)}</p>
      <p class="backup-today">${days === 0 ? '✓ 今日はバックアップを取りました' : '今日はまだ取っていません'}</p>
    </div>

    <section class="group">
      <h2 class="section-title">書き出す</h2>
      <div class="card">
        <p>すべての記録と設定を、1つのファイルにして保存します。</p>
        <button type="button" class="btn btn-primary btn-block" id="export-btn">スマホに保存(ダウンロード)</button>
        <p class="hint">「Files(ファイル)」アプリの「ダウンロード」に保存されます。</p>
        ${share ? `
          <button type="button" class="btn btn-block mt-group" id="share-btn">Googleドライブなどに保存</button>
          <p class="hint">出てきた画面で「ドライブ」を選ぶと、Googleドライブに保存できます。スマホをなくしたときも安心です。ファイルの名前の最後は「.txt」になりますが、中身は同じバックアップです。</p>` : ''}
        <p class="hint">ファイルには記録がすべて入っています。人に送らないよう気をつけてね。</p>
      </div>
    </section>

    <section class="group">
      <h2 class="section-title">読み込む</h2>
      <div class="card">
        <p>書き出したファイルから、記録をもとに戻します。</p>
        <button type="button" class="btn btn-block" id="import-btn">ファイルを選んで読み込む</button>
        <input type="file" id="import-file" accept=".json,.txt,application/json,text/plain" hidden>
        <p class="hint">いまアプリに入っている記録は、ファイルの内容に置き換わります。読み込む前の記録は自動でとっておくので、あとから戻せます。</p>
      </div>
    </section>

    ${undo?.backup ? undoCard(undo) : ''}
  `;

  const done = () => { if (!isStale()) renderBackup(el, params, isStale); };

  el.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      const { blob, name } = await makeBackupFile();
      downloadBlob(blob, name);
      await markBackedUp();
      toast('保存しました');
      done();
    } catch (e) {
      console.error(e);
      toast('保存できませんでした');
    }
  });

  el.querySelector('#share-btn')?.addEventListener('click', async () => {
    let file = pendingShare && Date.now() - pendingShare.at < 60000 ? pendingShare.file : null;
    pendingShare = null;
    try {
      if (!file) {
        const { blob, name, type } = await makeBackupFile({ asText: true });
        file = new File([blob], name, { type });
      }
      await navigator.share({ files: [file], title: file.name });
      await markBackedUp();
      toast('保存先に渡しました');
      done();
    } catch (e) {
      if (e.name === 'AbortError') return; // 共有の画面で、やめたとき
      if (e.name === 'NotAllowedError' && file) {
        pendingShare = { file, at: Date.now() };
        toast('もう一度ボタンを押してください');
        return;
      }
      console.error(e);
      toast('共有できませんでした。「スマホに保存」を使ってください');
    }
  });

  const fileInput = el.querySelector('#import-file');
  el.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
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
      message: `${s.exportedAt ? formatDateTimeJa(new Date(s.exportedAt)) : '日時不明'} に書き出したファイル\n記録 ${s.records}件\n\nいまアプリに入っている記録は、このファイルの内容に置き換わります。\n読み込む前の記録はとっておくので、あとから「読み込む前に戻す」で戻せます。`,
      ok: '読み込む',
      danger: true,
    });
    if (!ok) return;
    try {
      await restoreBackup(backup);
      toast('読み込みました');
      navigate('');
    } catch (e) {
      console.error(e);
      toast('読み込めませんでした(記録は変わっていません)');
    }
  });

  el.querySelector('#undo-btn')?.addEventListener('click', async () => {
    const before = undo.kind === 'beforeImport';
    const ok = await confirmDialog({
      title: before ? '読み込む前の記録に戻しますか?' : '読み込んだ記録に戻しますか?',
      message: `${formatDateTimeJa(new Date(undo.savedAt))} にとっておいた記録(記録 ${summarize(undo.backup).records}件)に戻します。\n\nいまの記録もとっておくので、もう一度押せば、また戻せます。`,
      ok: '戻す',
    });
    if (!ok) return;
    try {
      await undoImport();
      toast('戻しました');
      navigate('');
    } catch (e) {
      console.error(e);
      toast('戻せませんでした(記録は変わっていません)');
    }
  });
}

function undoCard(undo) {
  const when = formatDateTimeJa(new Date(undo.savedAt));
  const n = summarize(undo.backup).records;
  const before = undo.kind === 'beforeImport';
  return `
    <section class="group">
      <h2 class="section-title">${before ? '読み込む前に戻す' : '読み込んだ記録に戻す'}</h2>
      <div class="card">
        <p>${before
          ? `${esc(when)} にファイルを読み込みました。その前の記録(記録 ${n}件)をとってあります。`
          : `${esc(when)} に、読み込む前の記録に戻しました。戻す前の記録(記録 ${n}件)をとってあります。`}</p>
        <button type="button" class="btn btn-block" id="undo-btn">${before ? '読み込む前の記録に戻す' : '読み込んだ記録に戻す'}</button>
        <p class="hint">とっておくのは、いちばん最近の1回分だけです。次にファイルを読み込むと入れかわります。</p>
      </div>
    </section>`;
}
