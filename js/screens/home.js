// ホーム画面

import { ROUTES } from '../routes.js';
import { href } from '../router.js';
import { getMeta } from '../db.js';
import { BACKUP_REMIND_DAYS } from '../config.js';
import { esc, formatDateJa, daysSince } from '../util.js';

const SECTIONS = [
  { title: '今日の記録', items: ['mood', 'condition', 'meal', 'medicine', 'vital'] },
  { title: '書く・ととのえる', items: ['diary', 'feelings'] },
  { title: '見返す', items: ['calendar', 'report'] },
];

function tile(key) {
  const r = ROUTES[key];
  return `<a class="tile tile-${key}" href="${href(key)}"><span class="tile-icon" aria-hidden="true">${r.icon}</span><span class="tile-label">${esc(r.title)}</span></a>`;
}

async function backupReminder() {
  const last = await getMeta('lastBackupAt');
  const since = last ? daysSince(last) : daysSince(await getMeta('installedAt'));
  if (since < BACKUP_REMIND_DAYS) return '';
  const text = last
    ? `最後のバックアップから${since}日たっています。`
    : 'まだバックアップを取っていません。';
  return `
    <a class="notice" href="${href('backup')}">
      <span aria-hidden="true">💾</span>
      <span>${text}<br><span class="small">よかったら、バックアップを取っておきましょう</span></span>
    </a>`;
}

export async function renderHome(el, params, isStale) {
  const reminder = await backupReminder();
  if (isStale()) return;
  el.innerHTML = `
    <p class="today">${formatDateJa(new Date())}</p>
    ${reminder}
    <a class="signal-btn" href="${href('signal')}">
      <span class="signal-dots" aria-hidden="true"><i class="sd-blue"></i><i class="sd-yellow"></i><i class="sd-red"></i><i class="sd-black"></i></span>
      <span>信号機をひらく</span>
    </a>
    ${SECTIONS.map((s) => `
      <section class="home-section">
        <h2 class="section-title">${esc(s.title)}</h2>
        <div class="tiles">${s.items.map(tile).join('')}</div>
      </section>`).join('')}
  `;
}
