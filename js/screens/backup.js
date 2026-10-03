// バックアップ画面

import { getMeta } from '../db.js';
import { makeBackupFile, markBackedUp, parseBackup, restoreBackup, summarize } from '../backup.js';
import { confirmDialog, toast } from '../ui.js';
import { navigate } from '../router.js';
import { esc, formatDateTimeJa, daysSince } from '../util.js';

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// iPhone は「共有」から「ファイルに保存」できる。
// Android の Chrome は .json ファイルの共有に対応していないため、このボタンは出ない。
function canShareFile() {
  try {
    const f = new File(['{}'], 'test.json', { type: 'application/json' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

export async function renderBackup(el, params, isStale) {
  const last = await getMeta('lastBackupAt');
  if (isStale()) return;

  const lastText = last
    ? `${formatDateTimeJa(new Date(last))}(${daysSince(last) === 0 ? '今日' : `${daysSince(last)}日前`})`
    : 'まだありません';
  const share = canShareFile();

  el.innerHTML = `
    <div class="card">
      <p class="muted small">最後のバックアップ</p>
      <p class="big-text">${esc(lastText)}</p>
    </div>

    <section class="group">
      <h2 class="section-title">書き出す</h2>
      <div class="card">
        <p>すべての記録と設定を、1つのファイルにして保存します。</p>
        <button type="button" class="btn btn-primary btn-block" id="export-btn">ファイルに書き出す</button>
        ${share ? '<button type="button" class="btn btn-block mt" id="share-btn">共有して保存する</button>' : ''}
        <p class="hint">ファイルには記録がすべて入っています。人に送らないよう気をつけてね。</p>
      </div>
    </section>

    <section class="group">
      <h2 class="section-title">読み込む</h2>
      <div class="card">
        <p>書き出したファイルから、記録をもとに戻します。</p>
        <button type="button" class="btn btn-block" id="import-btn">ファイルを選んで読み込む</button>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <p class="hint">いまアプリに入っている記録は、ファイルの内容に置き換わります。</p>
      </div>
    </section>
  `;

  el.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      const { blob, name } = await makeBackupFile();
      downloadBlob(blob, name);
      await markBackedUp();
      toast('書き出しました');
      renderBackup(el, params, isStale);
    } catch (e) {
      console.error(e);
      toast('書き出せませんでした');
    }
  });

  el.querySelector('#share-btn')?.addEventListener('click', async () => {
    try {
      const { blob, name } = await makeBackupFile();
      await navigator.share({ files: [new File([blob], name, { type: 'application/json' })] });
      await markBackedUp();
      toast('保存しました');
      renderBackup(el, params, isStale);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        toast('共有できませんでした');
      }
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
      message: `${s.exportedAt ? formatDateTimeJa(new Date(s.exportedAt)) : '日時不明'} に書き出したファイル\n記録 ${s.records}件\n\nいまアプリに入っている記録は、このファイルの内容に置き換わります。`,
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
      toast('読み込めませんでした');
    }
  });
}
