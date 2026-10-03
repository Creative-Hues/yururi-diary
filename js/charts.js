// 1週間分の折れ線グラフ(SVG)
// 外部ライブラリを使わないので、オフラインでも表示・印刷できる。
// 横軸は7日間(1日の中の時刻の位置まで反映)、縦軸は値。

import { esc } from './util.js';

const W = 340;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 34;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const fmt = (v, decimals) => (decimals ? v.toFixed(decimals) : String(Math.round(v)));

// days: 7つの「YYYY-MM-DD」
// series: [{ points: [{ at: 'YYYY-MM-DDTHH:mm', value }], dashed }]
// yTicks: [{ value, label }]
export function weekChart({ days, series, yMin, yMax, yTicks, height = 150, padL = 40, valueLabels = false, decimals = 0, label = '' }) {
  const H = height;
  const plotW = W - padL - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const dayW = plotW / days.length;

  const x = (at) => {
    const i = days.indexOf(at.slice(0, 10));
    const [hh, mm] = at.slice(11, 16).split(':').map(Number);
    return padL + (i + (hh * 60 + mm) / 1440) * dayW;
  };
  const y = (v) => PAD_T + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const parts = [];
  // 横の目盛り線
  for (const t of yTicks) {
    const ty = y(t.value);
    parts.push(`<line class="ch-grid" x1="${padL}" x2="${W - PAD_R}" y1="${ty}" y2="${ty}"/>`);
    parts.push(`<text class="ch-axis" x="${padL - 6}" y="${ty + 3.5}" text-anchor="end">${esc(t.label)}</text>`);
  }
  // 日の区切りと日付
  days.forEach((d, i) => {
    const x0 = padL + i * dayW;
    parts.push(`<line class="ch-day" x1="${x0}" x2="${x0}" y1="${PAD_T}" y2="${PAD_T + plotH}"/>`);
    const [yy, m, dd] = d.split('-').map(Number);
    const wd = WEEKDAYS[new Date(yy, m - 1, dd).getDay()];
    const cx = x0 + dayW / 2;
    parts.push(`<text class="ch-axis" x="${cx}" y="${H - PAD_B + 14}" text-anchor="middle">${m}/${dd}</text>`);
    parts.push(`<text class="ch-axis" x="${cx}" y="${H - PAD_B + 26}" text-anchor="middle">(${wd})</text>`);
  });
  parts.push(`<line class="ch-day" x1="${W - PAD_R}" x2="${W - PAD_R}" y1="${PAD_T}" y2="${PAD_T + plotH}"/>`);

  // 線と点
  for (const s of series) {
    const pts = s.points
      .filter((p) => p.value != null && days.includes(p.at.slice(0, 10)))
      .map((p) => ({ x: x(p.at), y: y(p.value), v: p.value }))
      .sort((a, b) => a.x - b.x);
    if (pts.length > 1) {
      parts.push(`<polyline class="ch-line${s.dashed ? ' dashed' : ''}" points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>`);
    }
    for (const p of pts) {
      parts.push(`<circle class="ch-dot${s.dashed ? ' hollow' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2"/>`);
      if (valueLabels) parts.push(`<text class="ch-val" x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle">${fmt(p.v, decimals)}</text>`);
    }
  }

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`;
}

// 値に合わせて縦軸の範囲と目盛り(最小・最大)を決める
export function autoScale(values, { decimals = 0, minSpan = 2 } = {}) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, minSpan);
  const mid = (lo + hi) / 2;
  const yMin = mid - span * 0.75;
  const yMax = mid + span * 0.75;
  const ticks = lo === hi
    ? [{ value: lo, label: fmt(lo, decimals) }]
    : [{ value: lo, label: fmt(lo, decimals) }, { value: hi, label: fmt(hi, decimals) }];
  return { yMin, yMax, yTicks: ticks };
}
