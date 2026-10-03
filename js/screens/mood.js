// 気分の記録(3-1)

import { getRecordsByType, newRecord, saveRecord } from '../db.js';
import { MOODS, TOUGH_MOODS, moodLabel } from '../constants.js';
import { recItem, sortByAt, timeOf } from '../components.js';
import { editRecordDialog } from '../record-dialog.js';
import { onToughMood } from '../support.js';
import { toast } from '../ui.js';
import { dateKey, esc } from '../util.js';

export async function renderMood(el, params, isStale) {
  const today = dateKey();
  const rows = sortByAt(await getRecordsByType('mood', today, today));
  if (isStale()) return;
  const rerender = () => renderMood(el, params, isStale);

  el.innerHTML = `
    <p class="lead">いまの気分は?</p>
    <div class="mood-list">
      ${MOODS.map((m) => `<button type="button" class="mood-btn" data-level="${m.level}">${esc(m.label)}</button>`).join('')}
    </div>
    <p class="hint">タップすると、いまの時刻で記録します。時刻はあとから直せます。</p>

    <section class="group">
      <h2 class="section-title">今日の気分</h2>
      ${rows.length
        ? `<div class="card rows">${rows.map((r) => recItem({ id: r.id, time: timeOf(r.at), main: esc(moodLabel(r.data.level)) })).join('')}</div>`
        : '<p class="empty">まだ記録はありません</p>'}
    </section>
  `;

  el.querySelectorAll('.mood-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      el.querySelectorAll('.mood-btn').forEach((x) => { x.disabled = true; }); // 二重タップ防止
      const { level } = b.dataset;
      await saveRecord(newRecord('mood', { level }));
      toast(`「${moodLabel(level)}」を記録しました`);
      await rerender();
      if (TOUGH_MOODS.includes(level)) onToughMood(level);
    });
  });

  el.querySelectorAll('.rec-item').forEach((b) => {
    b.addEventListener('click', async () => {
      const rec = rows.find((r) => r.id === b.dataset.id);
      let level = rec.data.level;
      const changed = await editRecordDialog({
        title: '気分を直す',
        rec,
        body: `<div class="seg-list">${MOODS.map((m) => `<button type="button" class="seg-btn" data-level="${m.level}" aria-pressed="${m.level === level}">${esc(m.label)}</button>`).join('')}</div>`,
        onMount(d) {
          d.querySelectorAll('.seg-btn').forEach((s) => {
            s.addEventListener('click', () => {
              level = s.dataset.level;
              d.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
            });
          });
        },
        apply() { rec.data.level = level; },
      });
      if (changed) rerender();
    });
  });
}
