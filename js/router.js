// 画面の行き来(URL の # の後ろで画面を切り替える。例:#/settings)
// GitHub Pages ではサーバー側の設定ができないため、# 方式にしている。

import { ROUTES } from './routes.js';
import { setHeader, confirmDialog } from './ui.js';
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

// 入力画面:保存せずに戻ろうとしたら確認する
// 開いたときに履歴を1つ積み、「戻る」(Android の戻る・ヘッダーの ‹)でそれが外れたら確認を出す。
// 返り値の leave(steps 省略可) は、保存・削除のあとに確認なしで画面を離れるときに使う。
export function guardLeave(isDirty) {
  history.pushState({ guard: true }, '');
  let active = true;
  let asking = false;

  const onPop = async () => {
    // ダイアログの開け閉めで guard の位置に戻っただけなら、何もしない
    if (!active || asking || history.state?.guard) return;
    if (isDirty()) {
      asking = true;
      const leave = await confirmDialog({
        title: '保存していない内容があります',
        message: '保存せずに戻りますか?',
        ok: '戻る',
        cancel: '入力を続ける',
      });
      asking = false;
      if (!leave) {
        history.pushState({ guard: true }, '');
        return;
      }
    }
    release();
    history.back();
  };
  const release = () => {
    active = false;
    window.removeEventListener('popstate', onPop);
  };
  window.addEventListener('popstate', onPop);

  return {
    release,
    // 入力画面と guard の2つ分戻る。戻った先が okHash でなければ、okHash に置き換える
    leave(okHash) {
      release();
      return new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          if (location.hash !== okHash) location.replace(okHash);
          resolve();
        };
        window.addEventListener('popstate', done, { once: true });
        setTimeout(done, 800);
        history.go(-2);
      });
    },
  };
}

let cleanup = null;

async function render() {
  cleanup?.();
  cleanup = null;
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
      const c = await route.render(el, params, () => seq !== renderSeq);
      if (typeof c === 'function') {
        if (seq === renderSeq) cleanup = c;
        else c();
      }
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
