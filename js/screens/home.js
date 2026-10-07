// ホーム画面

import { ROUTES } from '../routes.js';
import { href } from '../router.js';
import { getMeta } from '../db.js';
import { getSettings } from '../prefs.js';
import { longOpenPeriod } from '../periods.js';
import { esc, formatDateJa, daysSince, pad2 } from '../util.js';

const SECTIONS = [
  // 「バックアップ」は記録の画面ではないが、空いている右下に置く(backupTile)
  { title: '今日の記録', items: ['mood', 'condition', 'meal', 'medicine', 'vital', 'backup'] },
  { title: '書く・ととのえる', items: ['diary', 'feelings'] },
  { title: '見返す', items: ['calendar', 'report'] },
];

function tile(key, backup) {
  if (key === 'backup') return backupTile(backup);
  const r = ROUTES[key];
  return `<a class="tile tile-${key}" href="${href(key)}"><span class="tile-icon" aria-hidden="true">${r.icon}</span><span class="tile-label">${esc(r.title)}</span></a>`;
}

// 前回から backupRemindDays 日以上たったか(一度も取っていなければ、すぐに知らせる)
function isDue(lastIso, remindDays, now = new Date()) {
  if (!lastIso) return true;
  return daysSince(lastIso, now) >= remindDays;
}

// 「9/3 21:15」(今年でなければ「2025/9/3 21:15」)
function shortDateTime(iso) {
  const d = new Date(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}/` : '';
  return `${year}${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function loadBackup() {
  const [last, settings] = await Promise.all([getMeta('lastBackupAt'), getSettings()]);
  return {
    last,
    today: !!last && daysSince(last) === 0,
    due: isDue(last, settings.backupRemindDays),
  };
}

// 今日取ったか・まだかが、ひと目で分かるようにする
function backupTile({ last, today, due }) {
  const d = last ? new Date(last) : null;
  let sub;
  let badge;
  let label;
  if (today) {
    sub = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    badge = '<span class="tile-ok">✓ 今日取った</span>';
    label = `バックアップ、今日 ${sub} に取りました`;
  } else {
    sub = last ? `前回 ${shortDateTime(last)}` : 'まだ取っていません';
    badge = `<span class="${due ? 'tile-due' : 'tile-sub'}">今日はまだ</span>`;
    label = `バックアップ、今日はまだ取っていません、${sub}`;
  }
  return `
    <a class="tile tile-backup${today ? ' is-done' : due ? ' is-due' : ''}" href="${href('backup')}" aria-label="${esc(label)}">
      <span class="tile-icon" aria-hidden="true">💾</span>
      <span class="tile-label">バックアップ</span>
      ${badge}
      <span class="tile-sub">${esc(sub)}</span>
    </a>`;
}

function periodNotice(open) {
  if (!open) return '';
  return `
    <a class="notice notice-soft" href="${href('condition')}">
      <span aria-hidden="true">🌸</span>
      <span>生理の帯がのび続けています。<br><span class="small">おわったら体調から記録してね</span></span>
    </a>`;
}

export async function renderHome(el, params, isStale) {
  const [backup, open] = await Promise.all([loadBackup(), longOpenPeriod()]);
  if (isStale()) return;
  el.innerHTML = `
    <p class="today">${formatDateJa(new Date())}</p>
    ${periodNotice(open)}
    <a class="signal-btn" href="${href('signal')}">
      <span class="signal-dots" aria-hidden="true"><i class="sd-blue"></i><i class="sd-yellow"></i><i class="sd-red"></i><i class="sd-black"></i></span>
      <span>信号機をひらく</span>
    </a>
    ${SECTIONS.map((s) => `
      <section class="home-section">
        <h2 class="section-title">${esc(s.title)}</h2>
        <div class="tiles">${s.items.map((k) => tile(k, backup)).join('')}</div>
      </section>`).join('')}
  `;
}
