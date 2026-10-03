// 設定画面

import { APP_VERSION, FEATURES } from '../config.js';
import { DB_VERSION, getMeta } from '../db.js';
import { getLock } from '../lock.js';
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
  const [settings, lastBackupAt, persisted, anonId, lock] = await Promise.all([
    getSettings(), getMeta('lastBackupAt'), isPersisted(), getMeta('anonId'), getLock(),
  ]);
  if (isStale()) return;

  const standalone = isStandalone();
  const lastText = lastBackupAt ? formatDateTimeJa(new Date(lastBackupAt)) : 'まだありません';
  // [名前, 値, 説明]
  const info = [
    ['アプリのバージョン', APP_VERSION, '不具合を伝えるときに使う番号です。'],
    ['記録のしくみの番号', String(DB_VERSION), '記録をしまう形の番号です。ふだんは気にしなくて大丈夫です。'],
    ['開き方', standalone ? 'ホーム画面から' : 'ブラウザから',
      standalone ? 'アプリとして開いています。' : 'ホーム画面に追加して開くのがおすすめです。'],
    ['記録の自動削除', persisted ? 'されない' : 'されることがある',
      persisted
        ? 'スマホの空き容量が少なくなっても、記録が自動で消されないようになっています。'
        : 'スマホの空き容量がとても少なくなると、記録が自動で消されることがあります。バックアップを取っておくと安心です。'],
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
        ${linkRow('lock', `<br><span class="small muted">${lock.enabled ? `オン${lock.credentialId ? '(指紋認証あり)' : ''}` : 'オフ'}</span>`)}
        ${FEATURES.feedback ? linkRow('feedback') : ''}
      </div>
    </section>

    <section class="group">
      <h2 class="section-title">アプリについて</h2>
      <div class="card rows">
        ${info.map(([k, v, note]) => `<div class="row info-row"><span>${esc(k)}<br><span class="small muted">${esc(note)}</span></span><span class="info-value">${esc(v)}</span></div>`).join('')}
        <div class="row info-copy"><button type="button" class="btn btn-block" id="copy-info">アプリの情報をコピー</button><span class="small muted">不具合を伝えるときに、貼りつけて使えます。</span></div>
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
      `ゆる〜り日記 ${APP_VERSION}(記録のしくみ ${DB_VERSION})`,
      `開き方:${standalone ? 'ホーム画面から' : 'ブラウザから'}`,
      `記録の自動削除:${persisted ? 'されない' : 'されることがある'}`,
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
