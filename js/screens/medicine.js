// 服薬の記録(3-4)

import { getRecordsByType, newRecord, saveRecord } from '../db.js';
import { getChoices } from '../choices.js';
import { LISTS } from '../constants.js';
import { datetimeField, readAt, recItem, timeOf, circled, sortByAt } from '../components.js';
import { numberDoses, countDoses, reachedLimit, countText } from '../doses.js';
import { editRecordDialog } from '../record-dialog.js';
import { href } from '../router.js';
import { openDialog, toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

const limitMessage = (limit) => `今日の上限(${limit}回)に達しています`;

function noteField(note = '') {
  return `
    <label class="field">
      <span class="field-label">前後の状況(書かなくてもOK)</span>
      <textarea class="input" name="note" rows="3">${esc(note)}</textarea>
    </label>`;
}

export async function renderMedicine(el, params, isStale) {
  const today = dateKey();
  const [meds, todays] = await Promise.all([getChoices(LISTS.medicine), getRecordsByType('medicine', today, today)]);
  if (isStale()) return;
  const rerender = () => renderMedicine(el, params, isStale);

  sortByAt(todays);
  const counts = countDoses(todays);
  const numbers = numberDoses(todays);

  // 今日の記録を薬ごとにまとめる(登録から消した薬も、記録があれば表示する)
  const groups = new Map(meds.map((m) => [m.id, { name: m.label, limit: m.limitPerDay ?? null, rows: [] }]));
  for (const r of todays) {
    if (!groups.has(r.data.medicineId)) groups.set(r.data.medicineId, { name: r.data.name, limit: null, rows: [] });
    groups.get(r.data.medicineId).rows.push(r);
  }
  const taken = [...groups.values()].filter((g) => g.rows.length);

  el.innerHTML = `
    ${meds.length ? `
      <p class="lead">飲んだ薬をタップしてね</p>
      <div class="med-list">
        ${meds.map((m) => {
          const n = counts.get(m.id) ?? 0;
          const limit = m.limitPerDay ?? null;
          return `
            <button type="button" class="med-btn" data-id="${esc(m.id)}">
              <span class="med-name">${esc(m.label)}</span>
              <span class="med-count">${countText(n, limit)}</span>
              ${reachedLimit(n, limit) ? `<span class="med-limit">${limitMessage(limit)}</span>` : ''}
            </button>`;
        }).join('')}
      </div>` : `
      <div class="card">
        <p>まだ薬が登録されていません。</p>
        <a class="btn btn-primary btn-block" href="${href('edit-medicine')}">薬を登録する</a>
      </div>`}

    <section class="group">
      <h2 class="section-title">今日飲んだ薬</h2>
      ${taken.length ? taken.map((g) => `
        <div class="card rows dose-group">
          <div class="row dose-head"><span>${esc(g.name)}</span><span class="muted small">${countText(g.rows.length, g.limit)}</span></div>
          ${g.rows.map((r) => recItem({ id: r.id, time: circled(numbers.get(r.id)), main: timeOf(r.at), sub: esc(r.data.note ?? '') })).join('')}
        </div>`).join('') : '<p class="empty">まだ記録はありません</p>'}
    </section>
    <a class="link-row" href="${href('edit-medicine')}">薬の登録・編集 ›</a>
  `;

  el.querySelectorAll('.med-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      const med = meds.find((m) => m.id === b.dataset.id);
      if (await recordDose(med)) rerender();
    });
  });

  el.querySelectorAll('.rec-item').forEach((b) => {
    b.addEventListener('click', async () => {
      if (await editDose(todays.find((r) => r.id === b.dataset.id))) rerender();
    });
  });
}

// 服薬の記録を直す・削除するダイアログ(カレンダーの日付ごとの一覧からも使う)。変えたら true
export function editDose(rec) {
  return editRecordDialog({
    title: rec.data.name,
    rec,
    atLabel: '飲んだ時刻',
    body: noteField(rec.data.note),
    apply(d) { rec.data.note = d.querySelector('[name="note"]').value.trim(); },
  });
}

async function recordDose(med) {
  const limit = med.limitPerDay ?? null;

  // 選んだ日時の日の回数で、上限の案内を出す(記録は止めない)
  const updateWarning = async (d) => {
    const date = readAt(d).slice(0, 10);
    const rows = await getRecordsByType('medicine', date, date);
    const n = rows.filter((r) => r.data.medicineId === med.id).length;
    const warn = d.querySelector('.dose-warning');
    warn.hidden = !reachedLimit(n, limit);
    warn.textContent = date === dateKey() ? limitMessage(limit) : `この日の上限(${limit}回)に達しています`;
  };

  const { value, el } = await openDialog({
    title: `${med.label}を記録`,
    body: `
      <p class="dose-warning" hidden></p>
      ${datetimeField(localDateTime(), '飲んだ時刻')}
      ${noteField()}`,
    buttons: [{ label: 'やめる' }, { label: '記録する', value: 'save', cls: 'btn-primary' }],
    onMount(d) {
      if (limit == null) return;
      updateWarning(d);
      d.querySelector('[name="at"]').addEventListener('change', () => updateWarning(d));
    },
  });
  if (value !== 'save') return false;
  await saveRecord(newRecord('medicine', {
    medicineId: med.id,
    name: med.label,
    note: el.querySelector('[name="note"]').value.trim(),
  }, readAt(el)));
  toast('記録しました');
  return true;
}
