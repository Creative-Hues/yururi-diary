// ホーム画面

import { ROUTES } from '../routes.js';
import { href } from '../router.js';
import { getMeta } from '../db.js';
import { BACKUP_REMIND_MONTHS } from '../config.js';
import { longOpenPeriod } from '../periods.js';
import { esc, formatDateJa, dateKey, pad2 } from '../util.js';

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

// 前回から BACKUP_REMIND_MONTHS か月以上たったか(まだ取っていなければ、使い始めてから)
function isDue(fromIso, now = new Date()) {
  const d = new Date(fromIso);
  d.setMonth(d.getMonth() + BACKUP_REMIND_MONTHS);
  return dateKey(now) >= dateKey(d);
}

// 「9/3 21:15」(今年でなければ「2025/9/3 21:15」)
function shortDateTime(iso) {
  const d = new Date(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}/` : '';
  return `${year}${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function loadBackup() {
  const [last, installedAt] = await Promise.all([getMeta('lastBackupAt'), getMeta('installedAt')]);
  return { last, due: isDue(last ?? installedAt ?? new Date().toISOString()) };
}

function backupTile({ last, due }) {
  const when = last ? `前回 ${shortDateTime(last)}` : 'まだ取っていません';
  return `
    <a class="tile tile-backup${due ? ' is-due' : ''}" href="${href('backup')}" aria-label="${esc(`バックアップ、${when}${due ? '、そろそろバックアップを取りましょう' : ''}`)}">
      <span class="tile-icon" aria-hidden="true">💾</span>
      <span class="tile-label">バックアップ</span>
      <span class="tile-sub">${esc(when)}</span>
      ${due ? '<span class="tile-due">そろそろ取ろう</span>' : ''}
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
