// 1週間分の折れ線グラフ(SVG)
// 外部ライブラリを使わないので、オフラインでも表示・印刷できる。
// 横軸は7日間(1日の中の時刻の位置まで反映)、縦軸は値。
//
// 拡大と数値の表示(相談用の表示):weekChart で HTML を作り、画面に入れたあと bindCharts(root) を呼ぶ。
// ・グラフの中だけ、2本の指で広げると横(時間)の向きに拡大(最大 MAX_SCALE 倍)。拡大中は1本の指で左右に動かせる。
//   縦は拡大しない(線が画面の外に出てしまわないように。縦に指を動かしたときは、ふつうにページがスクロールする)。
//   拡大は SVG を伸ばすのではなく、点の位置だけを計算しなおして描き直すので、文字の大きさは変わらず、
//   点と点の間が広がって、各点の数値が重ならずに読める。
// ・ダブルタップ・「元に戻す」で元の大きさ。PC は Ctrl+ホイール(タッチパッドのピンチ)と「＋」「−」も使える。
// ・点をタップすると、その日時と数値を吹き出しで出す(ピンチが苦手なとき用)。
// ・ピンチ中はページがスクロール・ズームしないよう、touchmove を止める(アプリ全体のズーム止めは no-zoom.js のまま)。
// ・印刷するときは、元の大きさに戻してから印刷される(beforeprint)。
// 拡大の状態は保存しない(開き直すと元の大きさ)。

import { esc } from './util.js';

const W = 340;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 34;
const MAX_SCALE = 8;
const LABEL_SCALE = 1.8; // この倍率以上に拡大したら、すべての点に数値を出す
const HOUR_TICK_PX = 110; // 1日の幅(SVG の単位)がこれ以上になったら、6時・12時・18時の線を出す
const TAP_RADIUS = 24; // 点をタップしたとみなす距離(画面の px)
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const fmt = (v, decimals) => (decimals ? v.toFixed(decimals) : String(Math.round(v)));
const f1 = (n) => n.toFixed(1);

// weekChart で作ったグラフの中身(bindCharts で取り出す)
const pending = new Map();
let seq = 0;

// days: 7つの「YYYY-MM-DD」
// series: [{ points: [{ at: 'YYYY-MM-DDTHH:mm', value }], sub, name }]
//   sub … 2本目の線(血圧の下)。水色の点線・白抜きの点で描く
//   name … 吹き出しに出す名前(例:「上」「下」)
// yTicks: [{ value, label }]
// unit … 吹き出しで数値の後ろに付ける単位
// format(value) … 吹き出しに出す文(気分など、数値でないとき)
// pointLabel(value) … 点の上に出す文(初期は数値)
export function weekChart(opts) {
  const id = `chart-${++seq}`;
  const o = {
    height: 150, padL: 40, valueLabels: false, decimals: 0, label: '', unit: '', ...opts, id,
  };
  o.H = o.height;
  o.plotW = W - o.padL - PAD_R;
  o.plotH = o.H - PAD_T - PAD_B;
  o.dayW = o.plotW / o.days.length;
  // 元の大きさでの位置(bx, by)を先に出しておく
  const bx = (at) => {
    const i = o.days.indexOf(at.slice(0, 10));
    const [hh, mm] = at.slice(11, 16).split(':').map(Number);
    return o.padL + (i + (hh * 60 + mm) / 1440) * o.dayW;
  };
  o.by = (v) => PAD_T + (1 - (v - o.yMin) / (o.yMax - o.yMin || 1)) * o.plotH;
  o.lines = o.series.map((s, si) => ({
    ...s,
    si,
    pts: s.points
      .filter((p) => p.value != null && o.days.includes(p.at.slice(0, 10)))
      .map((p) => ({ at: p.at, v: p.value, bx: bx(p.at), by: o.by(p.value) }))
      .sort((a, b) => a.bx - b.bx),
  }));
  pending.set(id, o);

  return `
    <div class="chart-box" data-chart="${id}">
      <div class="chart-stage">
        <svg class="chart" viewBox="0 0 ${W} ${o.H}" role="img" aria-label="${esc(o.label)}">${svgInner(o, { s: 1, tx: 0 }, null)}</svg>
        <div class="ch-tip" role="status" hidden></div>
      </div>
      <div class="chart-tools no-print">
        <button type="button" class="chart-tool" data-zoom="out" aria-label="小さくする" disabled>−</button>
        <button type="button" class="chart-tool" data-zoom="in" aria-label="大きくする">＋</button>
        <button type="button" class="btn btn-small chart-reset" data-zoom="reset" hidden>元に戻す</button>
      </div>
    </div>`;
}

const dayParts = (d) => {
  const [yy, m, dd] = d.split('-').map(Number);
  return { m, dd, wd: WEEKDAYS[new Date(yy, m - 1, dd).getDay()] };
};

// 吹き出しの日時「10/3(金) 21:15」
const tipDate = (at) => {
  const { m, dd, wd } = dayParts(at.slice(0, 10));
  return `${m}/${dd}(${wd}) ${at.slice(11, 16)}`;
};

// v: { s: 横の倍率, tx: 横にずらす量(SVG の単位) }、pick: 選んだ点の at
function svgInner(o, v, pick) {
  const { H, plotW, plotH, dayW, padL } = o;
  const X = (bx) => padL + (bx - padL) * v.s + v.tx;
  const right = padL + plotW;
  const bottom = PAD_T + plotH;
  const inX = (x) => x >= padL - 0.5 && x <= right + 0.5;
  const parts = [];

  // 横の目盛り線
  for (const t of o.yTicks) {
    const ty = o.by(t.value);
    parts.push(`<line class="ch-grid" x1="${padL}" x2="${right}" y1="${f1(ty)}" y2="${f1(ty)}"/>`);
    parts.push(`<text class="ch-axis" x="${padL - 6}" y="${f1(ty + 3.5)}" text-anchor="end">${esc(t.label)}</text>`);
  }

  // 日の区切りと日付(拡大して日の一部だけ見えているときは、見えている部分の真ん中に出す)
  const dayPx = dayW * v.s;
  o.days.forEach((d, i) => {
    const x0 = X(padL + i * dayW);
    const x1 = x0 + dayPx;
    if (inX(x0)) parts.push(`<line class="ch-day" x1="${f1(x0)}" x2="${f1(x0)}" y1="${PAD_T}" y2="${bottom}"/>`);
    if (dayPx >= HOUR_TICK_PX) {
      for (const h of [6, 12, 18]) {
        const hx = x0 + (dayPx * h) / 24;
        if (!inX(hx)) continue;
        parts.push(`<line class="ch-hour" x1="${f1(hx)}" x2="${f1(hx)}" y1="${PAD_T}" y2="${bottom}"/>`);
        parts.push(`<text class="ch-hour-label" x="${f1(hx)}" y="${PAD_T - 4}" text-anchor="middle">${h}時</text>`);
      }
    }
    const a = Math.max(x0, padL);
    const b = Math.min(x1, right);
    if (b - a < 26) return;
    const { m, dd, wd } = dayParts(d);
    const cx = (a + b) / 2;
    parts.push(`<text class="ch-axis" x="${f1(cx)}" y="${H - PAD_B + 14}" text-anchor="middle">${m}/${dd}</text>`);
    parts.push(`<text class="ch-axis" x="${f1(cx)}" y="${H - PAD_B + 26}" text-anchor="middle">(${wd})</text>`);
  });
  parts.push(`<line class="ch-day" x1="${right}" x2="${right}" y1="${PAD_T}" y2="${bottom}"/>`);

  // 線と点(グラフの枠の中だけに描く)
  const showLabels = o.valueLabels || v.s >= LABEL_SCALE;
  const inner = [];
  for (const s of o.lines) {
    const pts = s.pts.map((p) => ({ ...p, x: X(p.bx), y: p.by }));
    const cls = s.sub ? ' sub' : '';
    if (pts.length > 1) {
      inner.push(`<polyline class="ch-line${cls}" points="${pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ')}"/>`);
    }
    for (const p of pts) {
      if (p.at === pick) inner.push(`<circle class="ch-pick" cx="${f1(p.x)}" cy="${f1(p.y)}" r="7"/>`);
      inner.push(`<circle class="ch-dot${cls}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="3.2"/>`);
      if (showLabels && inX(p.x)) {
        const text = o.pointLabel ? o.pointLabel(p.v) : fmt(p.v, o.decimals);
        // 2本目(血圧の下)は点の下に出して、上の数値と重ならないようにする
        const ly = s.sub ? p.y + 14 : p.y - 7;
        inner.push(`<text class="ch-val${cls}" x="${f1(p.x)}" y="${f1(ly)}" text-anchor="middle">${esc(text)}</text>`);
      }
    }
  }
  // 横は枠の中だけに描く(点や数値が枠の線で切れないよう、少しだけ広く切り取る)。縦は切らない
  parts.push(`<clipPath id="${o.id}-clip"><rect x="${padL - 4}" y="0" width="${plotW + 8}" height="${H}"/></clipPath>`);
  parts.push(`<g clip-path="url(#${o.id}-clip)">${inner.join('')}</g>`);
  return parts.join('');
}

// 画面に入れたグラフに、拡大・点のタップを付ける。片付ける関数を返す
export function bindCharts(root) {
  const resets = [];
  root.querySelectorAll('.chart-box[data-chart]').forEach((box) => {
    const o = pending.get(box.dataset.chart);
    pending.delete(box.dataset.chart);
    if (o) resets.push(attach(box, o));
  });
  // 拡大したまま印刷しても、元の大きさで印刷されるように
  const onPrint = () => resets.forEach((r) => r());
  window.addEventListener('beforeprint', onPrint);
  return () => window.removeEventListener('beforeprint', onPrint);
}

function attach(box, o) {
  const stage = box.querySelector('.chart-stage');
  const svg = stage.querySelector('svg');
  const tip = stage.querySelector('.ch-tip');
  const btnIn = box.querySelector('[data-zoom="in"]');
  const btnOut = box.querySelector('[data-zoom="out"]');
  const btnReset = box.querySelector('[data-zoom="reset"]');
  let v = { s: 1, tx: 0 };
  let pick = null;
  let raf = 0;

  const clamp = () => {
    v.s = Math.min(MAX_SCALE, Math.max(1, v.s));
    v.tx = Math.min(0, Math.max(o.plotW * (1 - v.s), v.tx));
  };

  const drawNow = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    svg.innerHTML = svgInner(o, v, pick);
    const zoomed = v.s > 1.001;
    box.classList.toggle('is-zoomed', zoomed);
    btnReset.hidden = !zoomed;
    btnOut.disabled = !zoomed;
    btnIn.disabled = v.s >= MAX_SCALE - 0.001;
    placeTip();
  };
  const draw = () => {
    if (!raf) raf = requestAnimationFrame(drawNow);
  };

  // 画面の座標 → SVG の座標(縦横の比率は同じ)
  const toSvg = (clientX, clientY) => {
    const r = svg.getBoundingClientRect();
    const k = W / r.width;
    return { x: (clientX - r.left) * k, y: (clientY - r.top) * k, k };
  };

  // 横の位置 sx を動かさずに、倍率を ns にする
  const zoomAt = (sx, ns) => {
    const target = Math.min(MAX_SCALE, Math.max(1, ns));
    const bx = (sx - o.padL - v.tx) / v.s;
    v = { s: target, tx: sx - o.padL - bx * target };
    clamp();
    draw();
  };
  const zoomCenter = (factor) => zoomAt(o.padL + o.plotW / 2, v.s * factor);

  const reset = () => {
    v = { s: 1, tx: 0 };
    pick = null;
    drawNow();
  };

  // 選んだ点(同じ日時の点はまとめる:血圧の上と下)
  const pickedPoints = () => o.lines.flatMap((s) => s.pts.filter((p) => p.at === pick).map((p) => ({ s, p })));

  function placeTip() {
    const hits = pick ? pickedPoints() : [];
    if (!hits.length) {
      tip.hidden = true;
      return;
    }
    const x = o.padL + (hits[0].p.bx - o.padL) * v.s + v.tx;
    const y = Math.min(...hits.map((h) => h.p.by));
    if (x < o.padL - 1 || x > o.padL + o.plotW + 1) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML = `
      <span class="ch-tip-date">${esc(tipDate(pick))}</span>
      ${hits.map(({ s, p }) => `<span class="ch-tip-row${s.sub ? ' sub' : ''}">${s.name ? `<span class="ch-tip-name">${esc(s.name)}</span>` : ''}<strong>${esc(o.format ? o.format(p.v) : fmt(p.v, o.decimals))}</strong>${o.format ? '' : `<small>${esc(o.unit)}</small>`}</span>`).join('')}`;
    tip.hidden = false;
    const k = stage.clientWidth / W;
    const left = Math.min(Math.max(x * k - tip.offsetWidth / 2, 0), stage.clientWidth - tip.offsetWidth);
    // 点の上に出す(グラフの上の見出しに少しかかってもよい)。上に入りきらないときだけ、点の下に
    let top = y * k - tip.offsetHeight - 12;
    if (top < -tip.offsetHeight / 2) top = Math.max(...hits.map((h) => h.p.by)) * k + 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  // タップした場所にいちばん近い点を選ぶ(近くになければ吹き出しを消す)
  const pickAt = (clientX, clientY) => {
    const { x, y, k } = toSvg(clientX, clientY);
    let best = null;
    let bestD = TAP_RADIUS * k;
    for (const s of o.lines) {
      for (const p of s.pts) {
        const d = Math.hypot(o.padL + (p.bx - o.padL) * v.s + v.tx - x, p.by - y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    pick = best && best.at !== pick ? best.at : null;
    drawNow();
  };

  // ---- タッチ(Pixel・iPhone) ----
  let g = null; // いまの指の動き
  let moved = false; // 指を動かした(このあとの click は点のタップにしない)
  const startPinch = (touches) => {
    const [a, b] = touches;
    const c = toSvg((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    g = { mode: 'pinch', d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, cx: c.x, v0: { ...v } };
  };
  const startOne = (t, decided) => {
    g = { mode: 'one', x0: t.clientX, y0: t.clientY, v0: { ...v }, decided, pan: decided && v.s > 1 };
  };

  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) moved = false;
    if (e.touches.length >= 2) startPinch(e.touches);
    else startOne(e.touches[0], false);
  }, { passive: true });

  stage.addEventListener('touchmove', (e) => {
    if (!g) return;
    if (e.touches.length >= 2) {
      e.preventDefault(); // ページのスクロール・ズームを止める
      if (g.mode !== 'pinch') startPinch(e.touches);
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const c = toSvg((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      // 指を置いたときの真ん中の点が、いまの指の真ん中に来るように
      const s = Math.min(MAX_SCALE, Math.max(1, g.v0.s * (d / g.d0)));
      const bx = (g.cx - o.padL - g.v0.tx) / g.v0.s;
      v = { s, tx: c.x - o.padL - bx * s };
      clamp();
      moved = true;
      draw();
      return;
    }
    if (g.mode === 'pinch') startOne(e.touches[0], true); // 2本のうち1本を離した:そのまま動かせる
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.decided) {
      if (Math.hypot(dx, dy) < 6) return;
      g.decided = true;
      // 拡大していないとき・縦に動かしたときは、ふつうにページをスクロール
      g.pan = v.s > 1 && Math.abs(dx) > Math.abs(dy);
    }
    if (!g.pan) return;
    e.preventDefault();
    const { k } = toSvg(0, 0);
    v = { ...v, tx: g.v0.tx + dx * k };
    clamp();
    moved = true;
    draw();
  }, { passive: false });

  const onTouchEnd = (e) => {
    if (e.touches.length === 0) g = null;
    else if (e.touches.length === 1 && g?.mode === 'pinch') startOne(e.touches[0], true);
  };
  stage.addEventListener('touchend', onTouchEnd);
  stage.addEventListener('touchcancel', onTouchEnd);

  // ---- マウス(PC):拡大中はドラッグで動かす ----
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    moved = false;
    if (v.s <= 1) return;
    drag = { x0: e.clientX, v0: { ...v } };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (!moved && Math.abs(dx) < 4) return;
    const { k } = toSvg(0, 0);
    v = { ...v, tx: drag.v0.tx + dx * k };
    clamp();
    moved = true;
    draw();
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Ctrl+ホイール(PC のタッチパッドのピンチもこれになる)
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAt(toSvg(e.clientX, e.clientY).x, v.s * Math.exp(-e.deltaY / 200));
  }, { passive: false });

  // ---- タップ:点を選ぶ。拡大中のダブルタップは元に戻す ----
  let lastTap = 0;
  stage.addEventListener('click', (e) => {
    if (moved) {
      moved = false;
      return;
    }
    const now = Date.now();
    if (now - lastTap < 350 && v.s > 1) {
      lastTap = 0;
      reset();
      return;
    }
    lastTap = now;
    pickAt(e.clientX, e.clientY);
  });

  btnIn.addEventListener('click', () => zoomCenter(1.6));
  btnOut.addEventListener('click', () => zoomCenter(1 / 1.6));
  btnReset.addEventListener('click', reset);

  return reset;
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
