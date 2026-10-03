// 服薬の記録(3-4)
// #/medicine … 飲んだ薬をタップして記録する。薬ごとに「薬の情報」をタップで開いて見られる
// #/medicine-new・#/medicine-edit/<id> … 薬の登録(名前・1日の上限回数・飲むタイミング・薬の詳細情報)
// #/edit-med-timings … 飲むタイミングの選択肢の編集(edit-choices.js)
// 薬の情報は choices の薬そのものに持つので、バックアップに入る。

import { get, getRecordsByType, newRecord, saveRecord } from '../db.js';
import { getChoices, addChoice, updateChoice } from '../choices.js';
import { LISTS } from '../constants.js';
import { datetimeField, readAt, recItem, timeOf, circled, sortByAt, parseNum, notFoundHtml, linesHtml, insertText, trackCursor } from '../components.js';
import { numberDoses, countDoses, reachedLimit, countText } from '../doses.js';
import { editRecordDialog } from '../record-dialog.js';
import { deleteOneWithConfirm } from './list-editor.js';
import { attachDraft, namedFields } from '../drafts.js';
import { href, leaveTo } from '../router.js';
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
  const [meds, todays, timingChoices] = await Promise.all([
    getChoices(LISTS.medicine), getRecordsByType('medicine', today, today), getChoices(LISTS.medTiming),
  ]);
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
          const info = medInfoHtml(m, timingChoices);
          return `
            <div class="med-item">
              <button type="button" class="med-btn" data-id="${esc(m.id)}">
                <span class="med-name">${esc(m.label)}</span>
                <span class="med-count">${countText(n, limit)}</span>
                ${reachedLimit(n, limit) ? `<span class="med-limit">${limitMessage(limit)}</span>` : ''}
              </button>
              ${info ? `<details class="med-info"><summary>薬の情報</summary>${info}</details>` : ''}
            </div>`;
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

// ---- 薬の情報 ----
// 飲むタイミングの選択肢は choices の 'medicine.timing'(本人が編集できる)。薬には選んだ id だけを持つので、
// 選択肢の名前を変えると薬の表示も変わり、選択肢を消すと薬から外れる(相談メモのタグと同じ)。

// 薬に付いている飲むタイミングの名前(選択肢の並び順)
export function timingLabels(med, timingChoices) {
  const ids = new Set(med.timings ?? []);
  return timingChoices.filter((t) => ids.has(t.id)).map((t) => t.label);
}

// 服薬の画面で開いて見る中身(飲むタイミングも詳細情報もなければ '')
function medInfoHtml(m, timingChoices) {
  const timings = timingLabels(m, timingChoices);
  const detail = (m.detail ?? '').trim();
  if (!timings.length && !detail) return '';
  return `
    <dl class="med-info-list">
      ${timings.length ? `<div><dt>飲むタイミング</dt><dd>${esc(timings.join('・'))}</dd></div>` : ''}
      ${detail ? `<div><dt>薬の詳細情報</dt><dd class="med-detail">${linesHtml(detail)}</dd></div>` : ''}
    </dl>`;
}

export function renderMedicineNew(el, params, isStale) {
  if (isStale()) return;
  return medicineForm(el, null, isStale);
}

export async function renderMedicineEdit(el, [id], isStale) {
  const med = await get('choices', id);
  if (isStale()) return;
  if (med?.list !== LISTS.medicine) {
    el.innerHTML = notFoundHtml;
    return;
  }
  return medicineForm(el, med, isStale);
}

async function medicineForm(el, med, isStale) {
  const [meds, timingChoices] = await Promise.all([getChoices(LISTS.medicine), getChoices(LISTS.medTiming)]);
  if (isStale()) return;
  const picked = new Set(med?.timings ?? []);

  el.innerHTML = `
    <div class="card">
      <label class="field">
        <span class="field-label">薬の名前</span>
        <input type="text" class="input" name="label" autocomplete="off" value="${esc(med?.label ?? '')}">
      </label>
      <label class="field">
        <span class="field-label">1日の上限回数(空欄なら上限なし)</span>
        <span class="with-unit"><input type="text" class="input" name="limit" inputmode="numeric" autocomplete="off" value="${esc(med?.limitPerDay ?? '')}"><span class="unit">回</span></span>
      </label>
      <div class="field">
        <div class="field-label-row">
          <span class="field-label">飲むタイミング(いくつでも選べます)</span>
          <a class="btn btn-small" href="${href('edit-med-timings')}">選択肢を編集</a>
        </div>
        ${timingChoices.length
          ? `<div class="chips" data-group="timings">${timingChoices.map((t) => `<button type="button" class="chip" data-timing="${esc(t.id)}" aria-pressed="${picked.has(t.id)}">${esc(t.label)}</button>`).join('')}</div>`
          : '<p class="small muted">選択肢がありません。「選択肢を編集」から追加できます。</p>'}
      </div>
      <div class="field">
        <div class="field-label-row">
          <span class="field-label">薬の詳細情報(書かなくてOK)</span>
          <button type="button" class="btn btn-small bullet-btn">・を入れる</button>
        </div>
        <textarea class="input" name="detail" rows="7" placeholder="何のための薬か・1回の量・注意することなど、自由に書けます。「・」で始めると箇条書きになります">${esc(med?.detail ?? '')}</textarea>
      </div>
    </div>
    ${med ? '<p class="hint">名前を変えたり削除したりしても、これまでの服薬の記録はそのまま残ります。</p>' : ''}
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">${med ? '保存する' : '登録する'}</button>
      ${med ? '<button type="button" class="btn btn-ghost-danger btn-block" id="delete-btn">この薬を削除</button>' : ''}
    </div>
  `;

  const ta = el.querySelector('[name="detail"]');
  trackCursor(ta);
  el.querySelector('.bullet-btn').addEventListener('click', () => insertText(ta, '・'));

  const chips = [...el.querySelectorAll('[data-group="timings"] .chip')];
  chips.forEach((c) => {
    c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')));
  });
  // いまある選択肢のうち、選んでいるもの(消した選択肢は外れる)
  const readTimings = () => chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.timing);

  // 下書き(新しく登録するとき/直すときで別々)。「選択肢を編集」に行って戻っても、書きかけが戻る
  const fields = namedFields(el, ['label', 'limit', 'detail']);
  const draft = await attachDraft({
    key: med ? `medicine-info:edit:${med.id}` : 'medicine-info:new',
    root: el,
    getState: () => ({ ...fields.get(), timings: readTimings() }),
    setState(v) {
      fields.set(v);
      const set = new Set(v.timings ?? []);
      chips.forEach((c) => c.setAttribute('aria-pressed', String(set.has(c.dataset.timing))));
    },
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const v = fields.get();
    const label = v.label.trim();
    if (!label) return toast('薬の名前を入れてね');
    if (meds.some((c) => c.label === label && c.id !== med?.id)) return toast('同じ名前の薬がすでにあります');
    const limit = parseNum(v.limit);
    if (limit != null && !(Number.isInteger(limit) && limit > 0)) return toast('上限回数は1以上の数字で入れてね');
    const info = { limitPerDay: limit, timings: readTimings(), detail: v.detail.replace(/\s+$/, '') };
    if (med) await updateChoice({ ...med, label, ...info });
    else await addChoice(LISTS.medicine, label, info);
    await draft.done();
    await leaveTo(href('edit-medicine'));
    toast(med ? '保存しました' : '登録しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (!(await deleteOneWithConfirm(med, 'これまでの服薬の記録は残ります。'))) return;
    await draft.done();
    await leaveTo(href('edit-medicine'));
  });

  return () => draft.dispose();
}
