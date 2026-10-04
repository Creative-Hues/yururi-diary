// 体調の記録(3-2)
// #/condition … 新しく記録(下に今日の記録)
// #/condition/<id> … その記録を直す
// 身体の「お通じ」「生理」は choices の kind で見分け、記録にも kind を残す(カレンダーの帯に使う)。
// 「生理」を選んだときは「はじまった」「おわった」のどちらかを選ぶ(phase)。

import { get, getRecordsByType, newRecord, saveRecord } from '../db.js';
import { getChoices } from '../choices.js';
import { LISTS, CHOICE_KINDS, PERIOD_PHASES, periodPhaseLabel } from '../constants.js';
import { datetimeField, readAt, recItem, sortByAt, timeOf, editLinkHtml, headRowHtml } from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, goBack, refresh } from '../router.js';
import { attachDraft } from '../drafts.js';
import { toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

const GROUPS = [
  { key: 'body', title: '身体', list: LISTS.body },
  { key: 'mind', title: '心', list: LISTS.mind },
];

// 一覧の1行に出す要約
export const choiceText = (c) => (c.kind === CHOICE_KINDS.period && c.phase ? `${c.label}(${periodPhaseLabel(c.phase)})` : c.label);

export function conditionSummary(data) {
  const parts = GROUPS.map((g) => [...(data[g.key] ?? []).map(choiceText), data[`${g.key}Other`]].filter(Boolean).join('・'));
  return parts.filter(Boolean).join(' / ');
}

export async function renderCondition(el, [id], isStale) {
  const today = dateKey();
  const [choices, rec, todays] = await Promise.all([
    Promise.all(GROUPS.map((g) => getChoices(g.list))),
    id ? get('records', id) : null,
    id ? [] : getRecordsByType('condition', today, today),
  ]);
  if (isStale()) return;
  if (id && rec?.type !== 'condition') {
    el.innerHTML = '<div class="card"><p>この記録は見つかりませんでした。</p></div>';
    return;
  }

  let phase = rec?.data.body?.find((c) => c.kind === CHOICE_KINDS.period)?.phase ?? null;
  const periodHtml = `
    <div class="period-phase" hidden>
      <span class="field-label period-label"></span>
      <div class="seg-row seg-row-2">${PERIOD_PHASES.map((p) => `<button type="button" class="seg-btn" data-phase="${p.phase}" aria-pressed="false">${p.label}</button>`).join('')}</div>
    </div>`;

  const groupHtml = (g, i) => {
    const selected = rec?.data[g.key] ?? [];
    const selectedIds = new Set(selected.map((c) => c.id));
    // 選択肢から消したものでも、この記録で選ばれていれば表示する
    const opts = [...choices[i], ...selected.filter((s) => !choices[i].some((c) => c.id === s.id))];
    return `
      <section class="group">
        ${i === 0
          ? headRowHtml(`<h2 class="section-title">${g.title}</h2>`, editLinkHtml(href('edit-condition'), '選択肢を編集'))
          : `<h2 class="section-title">${g.title}</h2>`}
        <div class="card">
          <div class="chips" data-group="${g.key}">
            ${opts.map((c) => `<button type="button" class="chip" data-id="${esc(c.id)}" data-label="${esc(c.label)}" data-kind="${esc(c.kind ?? '')}" aria-pressed="${selectedIds.has(c.id)}">${esc(c.label)}</button>`).join('')}
          </div>
          ${g.key === 'body' ? periodHtml : ''}
          <label class="field">
            <span class="field-label">その他</span>
            <textarea class="input" name="${g.key}Other" rows="2" placeholder="自由に書けます">${esc(rec?.data[`${g.key}Other`] ?? '')}</textarea>
          </label>
        </div>
      </section>`;
  };

  el.innerHTML = `
    ${GROUPS.map(groupHtml).join('')}
    <div class="card mt-group">${datetimeField(rec?.at ?? localDateTime())}</div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">${rec ? '保存する' : '記録する'}</button>
      ${rec ? '<button type="button" class="btn btn-ghost-danger btn-block" id="delete-btn">この記録を削除</button>' : ''}
    </div>
    <p class="hint">どれか1つだけでも記録できます。</p>
    ${rec ? '' : `
      <section class="group">
        <h2 class="section-title">今日の体調</h2>
        ${todays.length
          ? `<div class="card rows">${sortByAt(todays).map((r) => recItem({ id: r.id, time: timeOf(r.at), main: esc(conditionSummary(r.data)) })).join('')}</div>`
          : '<p class="empty">まだ記録はありません</p>'}
      </section>`}
  `;

  // 生理を選んでいるときだけ「はじまった/おわった」を出す
  const phaseBox = el.querySelector('.period-phase');
  const periodChip = () => el.querySelector('.chip[data-kind="period"][aria-pressed="true"]');
  const periodOn = () => !!periodChip();
  const showPhase = () => {
    if (!phaseBox) return;
    phaseBox.hidden = !periodOn();
    if (periodOn()) phaseBox.querySelector('.period-label').textContent = `${periodChip().dataset.label}は?`;
    phaseBox.querySelectorAll('[data-phase]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === phase)));
  };
  phaseBox?.querySelectorAll('[data-phase]').forEach((b) => {
    b.addEventListener('click', () => {
      phase = b.dataset.phase;
      showPhase();
    });
  });
  showPhase();

  el.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => {
      c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
      showPhase();
    });
  });

  // 下書き(新しく記録するとき/直すときで別々)。選んだチップは id で覚える
  const atInput = el.querySelector('[name="at"]');
  const draft = await attachDraft({
    key: rec ? `condition:edit:${rec.id}` : 'condition:new',
    root: el,
    getState: () => ({
      ...Object.fromEntries(GROUPS.flatMap((g) => [
        [g.key, [...el.querySelectorAll(`[data-group="${g.key}"] .chip[aria-pressed="true"]`)].map((c) => c.dataset.id)],
        [`${g.key}Other`, el.querySelector(`[name="${g.key}Other"]`).value],
      ])),
      at: atInput.value,
      phase,
    }),
    setState(v) {
      for (const g of GROUPS) {
        const ids = new Set(v[g.key] ?? []);
        el.querySelectorAll(`[data-group="${g.key}"] .chip`).forEach((c) => c.setAttribute('aria-pressed', String(ids.has(c.dataset.id))));
        el.querySelector(`[name="${g.key}Other"]`).value = v[`${g.key}Other`] ?? '';
      }
      if (v.at) atInput.value = v.at;
      phase = v.phase ?? null;
      showPhase();
    },
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const data = {};
    for (const g of GROUPS) {
      data[g.key] = [...el.querySelectorAll(`[data-group="${g.key}"] .chip[aria-pressed="true"]`)]
        .map((c) => {
          const item = { id: c.dataset.id, label: c.dataset.label };
          if (c.dataset.kind) item.kind = c.dataset.kind;
          if (c.dataset.kind === CHOICE_KINDS.period) item.phase = phase;
          return item;
        });
      data[`${g.key}Other`] = el.querySelector(`[name="${g.key}Other"]`).value.trim();
    }
    if (!GROUPS.some((g) => data[g.key].length || data[`${g.key}Other`])) {
      toast('どれか1つ選ぶか、書いてから保存してね');
      return;
    }
    if (periodOn() && !phase) {
      toast(`${periodChip().dataset.label}は「はじまった」か「おわった」を選んでね`);
      return;
    }
    const at = readAt(el, rec?.at);
    if (rec) {
      rec.data = data;
      rec.at = at;
      await saveRecord(rec);
      await draft.done();
      toast('保存しました');
      goBack();
    } else {
      await saveRecord(newRecord('condition', data, at));
      await draft.done();
      toast('記録しました');
      refresh();
    }
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (!(await deleteRecordWithConfirm(rec))) return;
    await draft.done();
    goBack();
  });

  el.querySelectorAll('.rec-item').forEach((b) => {
    b.addEventListener('click', () => { location.hash = href('condition', b.dataset.id); });
  });

  return () => draft.dispose();
}
