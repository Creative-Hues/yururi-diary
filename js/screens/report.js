// 相談用の表示(3-10)
// #/report/day/<日付>  … 1日分
// #/report/week/<日付> … 1週間分(その日までの7日間)
// いちばん上に、選んだ日がある月のカレンダー(カレンダーの画面と同じ表示。期間の日は枠で囲む)。
// 診察で画面をそのまま見せられるよう、項目ごとに枠でまとめる。
// 「印刷・PDFで保存」はブラウザの印刷機能を使う(印刷用の見た目は css の @media print)。

import { getAll, getRecordsInRange } from '../db.js';
import { getChoices } from '../choices.js';
import { MOODS, LISTS, moodLabel } from '../constants.js';
import { isDateKey, shiftDate, timeOf, sortByAt, circled, fmtNum } from '../components.js';
import { weekChart, autoScale } from '../charts.js';
import { numberDoses } from '../doses.js';
import { loadMonth, monthGridHtml, legendHtml } from '../month-calendar.js';
import { moodEmoji } from '../prefs.js';
import { choiceText } from './condition.js';
import { consultTagLabels, sortComments } from './consult.js';
import { href } from '../router.js';
import { APP_SHORT_NAME, APP_VERSION } from '../config.js';
import { dateKey, esc, formatDateJa, formatDateTimeJa, parseLocalDateTime } from '../util.js';

const MOOD_VALUE = Object.fromEntries(MOODS.map((m, i) => [m.level, MOODS.length - 1 - i])); // とても良い=4 … とてもしんどい=0
const dayLabel = (d) => formatDateJa(parseLocalDateTime(`${d}T00:00`));
const shortDay = (d) => dayLabel(d).replace(/^\d+月/, (s) => s.replace('月', '/')).replace('日', '');
const none = (text = '記録なし') => `<p class="rp-none">${text}</p>`;

function section(title, body, note = '') {
  return `
    <section class="rp-section">
      <h2 class="rp-title">${esc(title)}${note ? `<span class="rp-note">${esc(note)}</span>` : ''}</h2>
      ${body}
    </section>`;
}

// ---- 気分 ----
function moodSection(recs, days, isWeek, settings) {
  if (!recs.length) return section('気分', none());
  if (!isWeek) {
    return section('気分', `<ul class="rp-times">${recs.map((r) => `<li><span class="rp-time">${timeOf(r.at)}</span>${esc(moodEmoji(settings, r.data.level))} ${esc(moodLabel(r.data.level))}</li>`).join('')}</ul>`);
  }
  const chart = weekChart({
    days,
    series: [{ points: recs.map((r) => ({ at: r.at, value: MOOD_VALUE[r.data.level] })) }],
    yMin: -0.4,
    yMax: MOODS.length - 0.6,
    yTicks: MOODS.map((m) => ({ value: MOOD_VALUE[m.level], label: m.label })),
    padL: 78,
    height: 170,
    label: '1週間の気分の変化',
  });
  const counts = MOODS.map((m) => [m.label, recs.filter((r) => r.data.level === m.level).length]).filter(([, n]) => n);
  return section('気分', `${chart}<p class="rp-counts">${counts.map(([l, n]) => `<span>${esc(l)} ${n}回</span>`).join('')}</p>`, `${recs.length}回記録`);
}

// ---- 体調 ----
function conditionSection(recs, isWeek) {
  if (!recs.length) return section('体調', none());
  const groups = [['body', '身体'], ['mind', '心']];
  if (!isWeek) {
    return section('体調', recs.map((r) => `
      <div class="rp-entry">
        <span class="rp-time">${timeOf(r.at)}</span>
        <div>${groups.map(([k, t]) => {
          const items = [...(r.data[k] ?? []).map(choiceText), r.data[`${k}Other`]].filter(Boolean);
          return items.length ? `<p><span class="rp-tag">${t}</span>${esc(items.join('・'))}</p>` : '';
        }).join('')}</div>
      </div>`).join(''));
  }
  const body = groups.map(([k, t]) => {
    const counts = new Map();
    for (const r of recs) for (const c of r.data[k] ?? []) counts.set(choiceText(c), (counts.get(choiceText(c)) ?? 0) + 1);
    const others = recs.filter((r) => r.data[`${k}Other`]).map((r) => `${shortDay(r.date)} ${r.data[`${k}Other`]}`);
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    return `
      <div class="rp-sub">
        <h3 class="rp-subtitle">${t}</h3>
        ${sorted.length ? `<p class="rp-counts">${sorted.map(([l, n]) => `<span>${esc(l)} ${n}回</span>`).join('')}</p>` : none('選択なし')}
        ${others.length ? `<p class="rp-other"><span class="rp-tag">その他</span>${others.map(esc).join(' / ')}</p>` : ''}
      </div>`;
  }).join('');
  return section('体調', body, `${recs.length}回記録`);
}

// ---- 服薬 ----
function medicineSection(recs, meds, days, isWeek) {
  if (!recs.length) return section('服薬', none());
  const limitOf = new Map(meds.map((m) => [m.id, m.limitPerDay ?? null]));
  const order = new Map(meds.map((m, i) => [m.id, i]));
  const byMed = new Map();
  for (const r of recs) {
    if (!byMed.has(r.data.medicineId)) byMed.set(r.data.medicineId, { name: r.data.name, rows: [] });
    byMed.get(r.data.medicineId).rows.push(r);
  }
  const numbers = numberDoses(recs);
  const list = [...byMed.entries()].sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99));

  const body = list.map(([id, g]) => {
    const limit = limitOf.get(id);
    const limitText = limit != null ? `(1日${limit}回まで)` : '';
    if (!isWeek) {
      return `
        <div class="rp-sub">
          <h3 class="rp-subtitle">${esc(g.name)} <span class="rp-note">${g.rows.length}回${limitText}</span></h3>
          <ul class="rp-times">${g.rows.map((r) => `<li><span class="rp-time">${circled(numbers.get(r.id))} ${timeOf(r.at)}</span>${esc(r.data.note ?? '')}</li>`).join('')}</ul>
        </div>`;
    }
    const perDay = days.map((d) => [d, g.rows.filter((r) => r.date === d)]).filter(([, rs]) => rs.length);
    return `
      <div class="rp-sub">
        <h3 class="rp-subtitle">${esc(g.name)} <span class="rp-note">計${g.rows.length}回${limitText}</span></h3>
        <table class="rp-table">
          ${perDay.map(([d, rs]) => `<tr><th>${shortDay(d)}</th><td class="num">${rs.length}回${limit != null && rs.length > limit ? ' ※' : ''}</td><td>${rs.map((r) => timeOf(r.at)).join('、')}</td></tr>`).join('')}
        </table>
      </div>`;
  }).join('');
  const over = isWeek && list.some(([id, g]) => {
    const limit = limitOf.get(id);
    return limit != null && days.some((d) => g.rows.filter((r) => r.date === d).length > limit);
  });
  return section('服薬', body + (over ? '<p class="rp-foot">※ 1日の上限回数をこえた日</p>' : ''));
}

// ---- バイタル ----
const VITAL_CHARTS = [
  { title: '体温', unit: '℃', keys: ['temp'], decimals: 1, minSpan: 1 },
  { title: '血圧', unit: 'mmHg', keys: ['bpHigh', 'bpLow'], minSpan: 20 },
  { title: '脈拍', unit: '回/分', keys: ['pulse'], minSpan: 10 },
  { title: '酸素(SpO2)', unit: '%', keys: ['spo2'], minSpan: 4 },
  { title: '体重', unit: 'kg', keys: ['weight'], decimals: 1, minSpan: 2 },
];
const dash = (v) => (v == null ? '<span class="rp-dash">–</span>' : esc(fmtNum(v)));

function vitalSection(recs, days, isWeek) {
  if (!recs.length) return section('バイタル', none());
  if (!isWeek) {
    return section('バイタル', `
      <div class="rp-scroll">
        <table class="rp-table rp-vitals">
          <thead><tr><th>時刻</th><th>体温<small>℃</small></th><th>血圧<small>mmHg</small></th><th>脈拍<small>回/分</small></th><th>SpO2<small>%</small></th><th>体重<small>kg</small></th></tr></thead>
          <tbody>${recs.map((r) => `<tr><th>${timeOf(r.at)}</th><td>${dash(r.data.temp)}</td><td>${r.data.bpHigh == null && r.data.bpLow == null ? dash(null) : `${dash(r.data.bpHigh)}/${dash(r.data.bpLow)}`}</td><td>${dash(r.data.pulse)}</td><td>${dash(r.data.spo2)}</td><td>${dash(r.data.weight)}</td></tr>`).join('')}</tbody>
        </table>
      </div>`);
  }
  const charts = VITAL_CHARTS.map((c) => {
    const values = recs.flatMap((r) => c.keys.map((k) => r.data[k])).filter((v) => v != null);
    if (!values.length) return `<div class="rp-chart"><h3 class="rp-subtitle">${c.title}<span class="rp-note">${c.unit}</span></h3>${none()}</div>`;
    const scale = autoScale(values, { decimals: c.decimals ?? 0, minSpan: c.minSpan });
    const series = c.keys.map((k, i) => ({ dashed: i > 0, points: recs.map((r) => ({ at: r.at, value: r.data[k] })) }));
    const count = recs.filter((r) => c.keys.some((k) => r.data[k] != null)).length;
    return `
      <div class="rp-chart">
        <h3 class="rp-subtitle">${c.title}<span class="rp-note">${c.unit}${c.keys.length > 1 ? '(実線:上・点線:下)' : ''}</span></h3>
        ${weekChart({ days, series, ...scale, decimals: c.decimals ?? 0, valueLabels: count <= 10, label: `${c.title}の推移` })}
      </div>`;
  }).join('');
  return section('バイタル', `<div class="rp-charts">${charts}</div>`, `${recs.length}回測定`);
}

// ---- 相談したいことメモ(未相談) ----
function consultSection(consults, tags) {
  const open = consults.filter((c) => !c.done).sort((a, b) => a.at.localeCompare(b.at));
  const item = (c) => {
    const labels = consultTagLabels(c, tags);
    const comments = sortComments(c.comments);
    return `
      <li>
        ${labels.length ? `<p class="rp-consult-tags">${labels.map((l) => `<span class="rp-tag">${esc(l)}</span>`).join('')}</p>` : ''}
        <p>${esc(c.text)}</p>
        <span class="rp-note">${dayLabel(c.at.slice(0, 10))}に書いたメモ</span>
        ${comments.length ? `<ul class="rp-comments">${comments.map((m) => `<li><span class="rp-note">相談後のメモ ${shortDay(m.at.slice(0, 10))} ${timeOf(m.at)}</span><p>${esc(m.text)}</p></li>`).join('')}</ul>` : ''}
      </li>`;
  };
  return section('相談したいこと', open.length
    ? `<ol class="rp-consults">${open.map(item).join('')}</ol>`
    : none('いまはありません'), '期間に関係なく、まだ相談していないもの');
}

export async function renderReport(el, [modeParam, dateParam], isStale) {
  const isWeek = modeParam === 'week';
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const days = isWeek ? Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 6)) : [date];
  const [y, m] = date.split('-').map(Number);
  const [records, consults, meds, tags, month] = await Promise.all([
    getRecordsInRange(days[0], date), getAll('consults'), getChoices(LISTS.medicine), getChoices(LISTS.consultTag), loadMonth(y, m),
  ]);
  if (isStale()) return;

  const of = (type) => sortByAt(records.filter((r) => r.type === type));
  const period = isWeek ? `${dayLabel(days[0])} 〜 ${dayLabel(date)}(7日間)` : dayLabel(date);
  const step = isWeek ? 7 : 1;

  el.innerHTML = `
    <div class="no-print rp-controls">
      <div class="seg-row seg-row-2">
        <button type="button" class="seg-btn" data-mode="day" aria-pressed="${!isWeek}">1日分</button>
        <button type="button" class="seg-btn" data-mode="week" aria-pressed="${isWeek}">1週間分</button>
      </div>
      <div class="day-nav">
        <button type="button" class="day-btn" data-shift="-${step}" aria-label="前へ">‹</button>
        <label class="day-label"><input type="date" class="day-input" value="${date}" aria-label="${isWeek ? '最後の日' : '日付'}">${date === dateKey() ? '<span class="today-badge">今日</span>' : ''}</label>
        <button type="button" class="day-btn" data-shift="${step}" aria-label="次へ">›</button>
      </div>
    </div>

    <article class="report">
      <header class="rp-header">
        <h1 class="rp-heading">相談用のまとめ</h1>
        <p class="rp-period">${period}</p>
        <p class="rp-made">${esc(APP_SHORT_NAME)}(${esc(APP_VERSION)})・${formatDateTimeJa(new Date())} 作成</p>
      </header>
      <section class="rp-section rp-calendar">
        <h2 class="rp-title">${y}年${m}月のカレンダー<span class="rp-note">枠で囲んだ日がこのまとめの期間</span></h2>
        ${monthGridHtml(month, { link: false, picked: new Set(days), markToday: false })}
        ${legendHtml(month.settings)}
      </section>
      ${moodSection(of('mood'), days, isWeek, month.settings)}
      ${conditionSection(of('condition'), isWeek)}
      ${medicineSection(of('medicine'), meds, days, isWeek)}
      ${vitalSection(of('vital'), days, isWeek)}
      ${consultSection(consults, tags)}
    </article>

    <div class="no-print form-actions">
      <button type="button" class="btn btn-primary btn-block" id="print-btn">印刷・PDFで保存</button>
    </div>
    <p class="hint no-print">印刷の画面で、保存先(プリンター)に「PDF として保存」を選ぶと PDF になります。</p>
  `;

  const go = (mode, d) => location.replace(href('report', mode, d));
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => go(b.dataset.mode, date)));
  el.querySelectorAll('[data-shift]').forEach((b) => b.addEventListener('click', () => go(isWeek ? 'week' : 'day', shiftDate(date, Number(b.dataset.shift)))));
  el.querySelector('.day-input').addEventListener('change', (e) => {
    if (isDateKey(e.target.value)) go(isWeek ? 'week' : 'day', e.target.value);
  });

  // PDF のファイル名は、印刷するときのページのタイトルになる
  el.querySelector('#print-btn').addEventListener('click', () => {
    const title = document.title;
    document.title = `ゆる〜り日記_相談用_${isWeek ? `${days[0]}〜${date}` : date}`;
    const restore = () => { document.title = title; };
    window.addEventListener('afterprint', restore, { once: true });
    window.print();
  });
}
