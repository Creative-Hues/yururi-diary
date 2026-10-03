// 画面の行き来(URL の # の後ろで画面を切り替える。例:#/settings)
// GitHub Pages ではサーバー側の設定ができないため、# 方式にしている。

import { ROUTES } from './routes.js';
import { setHeader } from './ui.js';
import { esc } from './util.js';

const view = () => document.getElementById('view');
let renderSeq = 0;

function parseHash() {
  const [name = '', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { name, params };
}

export function href(name, ...params) {
  return `#/${[name, ...params].map(encodeURIComponent).join('/')}`;
}

export function navigate(name, ...params) {
  location.hash = href(name, ...params);
}

// 戻るボタン:履歴を1つ戻る(起動時にホームを下に敷いているので、必ずアプリ内に戻る)
export function goBack() {
  history.back();
}

async function render() {
  const seq = ++renderSeq;
  let { name, params } = parseHash();
  if (!ROUTES[name]) {
    history.replaceState(null, '', '#/');
    name = '';
    params = [];
  }
  const route = ROUTES[name];
  const el = view();
  setHeader({ title: route.title, isHome: name === '' });

  const html = route.render ? null : route.children ? menuHtml(route) : placeholderHtml(route);
  if (html != null) {
    el.innerHTML = html;
  } else {
    el.innerHTML = '';
    try {
      await route.render(el, params, () => seq !== renderSeq);
    } catch (e) {
      console.error(e);
      if (seq === renderSeq) el.innerHTML = `<div class="card"><p>表示できませんでした。</p><p class="muted small">${esc(e.message)}</p></div>`;
    }
  }
  if (seq === renderSeq) window.scrollTo(0, 0);
}

function menuHtml(route) {
  return `<div class="menu-list">${route.children.map((key) => {
    const r = ROUTES[key];
    return `<a class="menu-item" href="${href(key)}"><span class="menu-icon" aria-hidden="true">${r.icon}</span><span>${esc(r.title)}</span><span class="chev" aria-hidden="true">›</span></a>`;
  }).join('')}</div>`;
}

function placeholderHtml(route) {
  return `
    <div class="card placeholder">
      <div class="ph-icon" aria-hidden="true">${route.icon ?? '🌸'}</div>
      <p class="ph-title">${esc(route.title)}</p>
      <p>この画面は、いま準備中です。</p>
      <p class="ph-phase">フェーズ${route.phase}で作ります</p>
    </div>`;
}

export function startRouter() {
  // ホーム以外の画面で開かれたときも、戻るボタンでホームに戻れるよう、履歴の下にホームを敷く
  const start = location.hash;
  if (parseHash().name !== '') {
    history.replaceState(null, '', '#/');
    history.pushState(null, '', start);
  } else if (!start) {
    history.replaceState(null, '', '#/');
  }
  window.addEventListener('hashchange', render);
  render();
}
