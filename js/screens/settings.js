// 設定画面

import { APP_VERSION, FEATURES } from '../config.js';
import { DB_VERSION, getMeta } from '../db.js';
import { getSettings, setSetting, VITALS_PER_DAY_MIN, VITALS_PER_DAY_MAX } from '../prefs.js';
import { href } from '../router.js';
import { ROUTES } from '../routes.js';
import { canPromptInstall, promptInstall, isPersisted } from '../pwa.js';
import { toast } from '../ui.js';
import { esc, formatDateTimeJa, isStandalone } from '../util.js';

function linkRow(key, note = '') {
  const r = ROUTES[key];
  const badge = r.phase ? `<span class="badge">準備中</span>` : '';
  return `<a class="row row-link" href="${href(key)}"><span>${esc(r.title)}${note}</span>${badge}<span class="chev" aria-hidden="true">›</span></a>`;
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function renderSettings(el, params, isStale) {
  const [settings, lastBackupAt, persisted, anonId] = await Promise.all([
    getSettings(), getMeta('lastBackupAt'), isPersisted(), getMeta('anonId'),
  ]);
  if (isStale()) return;

  const standalone = isStandalone();
  const lastText = lastBackupAt ? formatDateTimeJa(new Date(lastBackupAt)) : 'まだありません';
  const info = [
    ['バージョン', APP_VERSION],
    ['データ形式', `v${DB_VERSION}`],
    ['起動のしかた', standalone ? 'ホーム画面から' : 'ブラウザで'],
    ['データの保護', persisted ? 'オン' : 'オフ'],
  ];

  el.innerHTML = `
    <section class="group">
      <h2 class="section-title">記録</h2>
      <div class="card rows">
        <div class="row">
          <span>バイタルの1日の測定回数</span>
          <div class="stepper" role="group" aria-label="バイタルの1日の測定回数">
            <button type="button" class="step-btn" data-step="-1" aria-label="へらす">−</button>
            <output id="vitals-count">${settings.vitalsPerDay}</output><span class="unit">回</span>
            <button type="button" class="step-btn" data-step="1" aria-label="ふやす">＋</button>
          </div>
        </div>
        ${linkRow('edit-condition')}
        ${linkRow('edit-medicine')}
        ${linkRow('edit-diary')}
      </div>
    </section>

    <section class="group">
      <h2 class="section-title">データ</h2>
      <div class="card rows">
        <a class="row row-link" href="${href('backup')}">
          <span>バックアップ<br><span class="small muted">最後のバックアップ:${esc(lastText)}</span></span>
          <span class="chev" aria-hidden="true">›</span>
        </a>
      </div>
    </section>

    <section class="group">
      <h2 class="section-title">安心のために</h2>
      <div class="card rows">
        ${linkRow('lock')}
        ${FEATURES.feedback ? linkRow('feedback') : ''}
      </div>
    </section>

    <section class="group">
      <h2 class="section-title">アプリについて</h2>
      <div class="card rows">
        ${info.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><span class="muted">${esc(v)}</span></div>`).join('')}
        <div class="row"><button type="button" class="btn btn-block" id="copy-info">アプリの情報をコピー</button></div>
      </div>
      ${standalone ? '' : installHelp()}
    </section>
  `;

  // バイタル回数
  const out = el.querySelector('#vitals-count');
  let vitals = settings.vitalsPerDay;
  el.querySelectorAll('.step-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      const next = Math.min(VITALS_PER_DAY_MAX, Math.max(VITALS_PER_DAY_MIN, vitals + Number(b.dataset.step)));
      if (next === vitals) return;
      vitals = next;
      out.textContent = vitals;
      await setSetting('vitalsPerDay', vitals);
    });
  });

  // 不具合報告のときに貼り付けられる情報
  el.querySelector('#copy-info').addEventListener('click', async () => {
    const text = [
      `ゆる〜り日記 ${APP_VERSION}(データ形式 v${DB_VERSION})`,
      `起動:${standalone ? 'ホーム画面' : 'ブラウザ'}`,
      `ID:${anonId ?? '-'}`,
      navigator.userAgent,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('コピーしました');
    } catch {
      toast('コピーできませんでした');
    }
  });

  el.querySelector('#install-btn')?.addEventListener('click', async () => {
    if (await promptInstall()) toast('ホーム画面に追加しました');
  });
}

function installHelp() {
  if (canPromptInstall()) {
    return `<button type="button" class="btn btn-primary btn-block mt" id="install-btn">ホーム画面に追加する</button>`;
  }
  const how = isIOS()
    ? '共有ボタン(□に↑)→「ホーム画面に追加」'
    : 'Chrome の右上「︙」→「ホーム画面に追加」または「アプリをインストール」';
  return `<p class="hint">ホーム画面に追加すると、アプリのように使えます。<br>${how}</p>`;
}
