// 不具合報告の部品:報告フォーム
// renderFeedbackForm(el, feedback, { onSent, attachDraft })
//   feedback  … createFeedback() で作ったもの
//   onSent    … 送れたあとに呼ぶ(「送った報告」の画面へ移るなど)
//   attachDraft … 入力中の内容を下書きとして残すしくみ(アプリから渡す。なければ下書きなし)
//                 attachDraft({ key, root, getState, setState }) → { done(), dispose() }

import { collectEnv, FeedbackError } from './client.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SEVERITY = [['data_lost', 'データが消えた'], ['unusable', '使えない'], ['inconvenient', '少し不便']];
const TRIED = [['restart', 'アプリをタスクキルして開き直した'], ['backup_reaccess', 'バックアップを取ってリンクから再アクセスした'], ['none', 'どちらも試していない']];
const FREQUENCY = [['always', '毎回'], ['sometimes', 'ときどき'], ['once', '1回だけ']];

// 「2026-10-03 14:05(UTC+9)」
function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset() / 60;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}(UTC${off >= 0 ? '+' : ''}${off})`;
}

const radios = (name, list) => list.map(([v, l]) => `
  <label class="fb-choice"><input type="radio" name="${name}" value="${v}"><span>${esc(l)}</span></label>`).join('');

export async function renderFeedbackForm(el, feedback, { onSent, attachDraft } = {}) {
  const { screens, ui } = feedback.options;
  const env = await collectEnv();
  // Pixel などは機種名を読めるので、最初から入れておく(直せる)
  const modelGuess = env.model ? (/^Pixel/i.test(env.model) ? `Google ${env.model}` : env.model) : '';

  el.innerHTML = `
    <div class="fb-notice">
      <p>開発者への連絡ができますが、修正されることを確約するものではないことをご了承ください。</p>
      <p>送信は1日5件までです。</p>
    </div>

    <form class="fb-form" novalidate>
      <div class="fb-field" data-field="kind">
        <span class="fb-label">種類 <em>必須</em></span>
        <div class="fb-seg">
          <label><input type="radio" name="kind" value="bug" checked><span>不具合</span></label>
          <label><input type="radio" name="kind" value="request"><span>要望</span></label>
        </div>
      </div>

      <label class="fb-field" data-field="title">
        <span class="fb-label">タイトル <em>必須</em></span>
        <input type="text" class="fb-input" name="title" maxlength="100" autocomplete="off" placeholder="どのような不具合か、かんたんに">
      </label>

      <label class="fb-field">
        <span class="fb-label">ニックネーム <small>(なくてもOK)</small></span>
        <input type="text" class="fb-input" name="nickname" maxlength="40" autocomplete="off">
      </label>

      <label class="fb-field" data-field="screen">
        <span class="fb-label">起きた画面・機能 <em>必須</em></span>
        <select class="fb-input" name="screen">
          <option value="">えらんでください</option>
          ${screens.map((s) => `<option>${esc(s)}</option>`).join('')}
        </select>
      </label>

      <label class="fb-field" data-field="content">
        <span class="fb-label">内容 <em>必須</em></span>
        <textarea class="fb-input" name="content" rows="6" maxlength="4000" placeholder="どの画面で、何をしたら、どうなったか"></textarea>
      </label>

      <div class="fb-field" data-field="severity">
        <span class="fb-label">困り度 <em>必須</em></span>
        ${radios('severity', SEVERITY)}
      </div>

      <div class="fb-field fb-bug-only" data-field="tried">
        <span class="fb-label">試したこと <small>(いくつでも)</small></span>
        ${TRIED.map(([v, l]) => `<label class="fb-choice"><input type="checkbox" name="tried" value="${v}"><span>${esc(l)}</span></label>`).join('')}
      </div>

      <div class="fb-field fb-bug-only" data-field="frequency">
        <span class="fb-label">起きる頻度 <em>必須</em></span>
        ${radios('frequency', FREQUENCY)}
      </div>

      <label class="fb-field" data-field="device">
        <span class="fb-label">使っているデバイスの機種 <em>必須</em></span>
        <input type="text" class="fb-input" name="device" maxlength="80" autocomplete="off" placeholder="例:Google Pixel 8" value="${esc(modelGuess)}">
      </label>

      <label class="fb-field">
        <span class="fb-label">直し方の希望 <small>(なくてもOK)</small></span>
        <textarea class="fb-input" name="wish" rows="3" maxlength="2000"></textarea>
        <span class="fb-hint">ご希望は参考にしますが、採用するとは限りません。</span>
      </label>

      <div class="fb-auto">
        <p class="fb-label">自動で付ける情報</p>
        <p>アプリ:${esc(feedback.options.appName)} ${esc(feedback.options.appVersion)}/OS:${esc(env.os || '不明')}/ホーム画面から:${env.standalone ? 'はい' : 'いいえ'}/送信日時/匿名ID</p>
      </div>

      <label class="fb-consent" data-field="consent">
        <input type="checkbox" name="consent">
        <span>内容は開発者に届きます。必要以上の個人情報は書かないでください。<em>(確認したらチェック)</em></span>
      </label>

      <button type="submit" class="fb-submit">送信する</button>
    </form>
  `;

  const form = el.querySelector('form');

  // 種類が「要望」のときは、試したこと・頻度を出さない
  const kind = () => form.querySelector('[name="kind"]:checked').value;
  const applyKind = () => {
    const isBug = kind() === 'bug';
    form.querySelectorAll('.fb-bug-only').forEach((x) => { x.hidden = !isBug; });
    form.querySelector('[name="title"]').placeholder = isBug ? 'どのような不具合か、かんたんに' : 'どんなことをしてほしいか、かんたんに';
  };
  form.querySelectorAll('[name="kind"]').forEach((r) => r.addEventListener('change', applyKind));
  applyKind();

  // 下書き(確認のチェックは毎回入れてもらうので、残さない)
  const TEXTS = ['title', 'nickname', 'screen', 'content', 'device', 'wish'];
  const RADIOS = ['kind', 'severity', 'frequency'];
  const draft = await attachDraft?.({
    key: `feedback:${feedback.options.appId}:new`,
    root: el,
    getState: () => ({
      ...Object.fromEntries(TEXTS.map((n) => [n, form.querySelector(`[name="${n}"]`).value])),
      ...Object.fromEntries(RADIOS.map((n) => [n, form.querySelector(`[name="${n}"]:checked`)?.value ?? ''])),
      tried: [...form.querySelectorAll('[name="tried"]:checked')].map((c) => c.value),
    }),
    setState(v) {
      for (const n of TEXTS) if (n in v) form.querySelector(`[name="${n}"]`).value = v[n];
      for (const n of RADIOS) form.querySelectorAll(`[name="${n}"]`).forEach((r) => { r.checked = r.value === v[n]; });
      form.querySelectorAll('[name="tried"]').forEach((c) => { c.checked = (v.tried ?? []).includes(c.value); });
      applyKind();
    },
  });

  // 「どちらも試していない」は、ほかと同時に選べない
  form.querySelectorAll('[name="tried"]').forEach((c) => {
    c.addEventListener('change', () => {
      if (!c.checked) return;
      form.querySelectorAll('[name="tried"]').forEach((o) => {
        if (o !== c && (c.value === 'none' || o.value === 'none')) o.checked = false;
      });
    });
  });

  let sending = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const v = (n) => form.querySelector(`[name="${n}"]`)?.value.trim() ?? '';
    const checked = (n) => form.querySelector(`[name="${n}"]:checked`)?.value ?? '';
    const isBug = kind() === 'bug';
    const report = {
      kind: kind(),
      title: v('title'),
      nickname: v('nickname'),
      screen: v('screen'),
      content: v('content'),
      severity: checked('severity'),
      tried: isBug ? [...form.querySelectorAll('[name="tried"]:checked')].map((c) => c.value) : [],
      frequency: isBug ? checked('frequency') : undefined,
      device: v('device'),
      wish: v('wish'),
      env: { appVersion: feedback.options.appVersion, os: env.os, ua: env.ua, standalone: env.standalone, sentAt: localStamp() },
    };

    // 必須の項目
    const missing = [
      ['title', report.title], ['screen', report.screen], ['content', report.content],
      ['severity', report.severity], ...(isBug ? [['frequency', report.frequency]] : []),
      ['device', report.device], ['consent', form.querySelector('[name="consent"]').checked],
    ].filter(([, ok]) => !ok).map(([k]) => k);
    form.querySelectorAll('.is-error').forEach((x) => x.classList.remove('is-error'));
    if (missing.length) {
      missing.forEach((k) => form.querySelector(`[data-field="${k}"]`)?.classList.add('is-error'));
      form.querySelector('.is-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      ui.toast(missing.includes('consent') && missing.length === 1 ? '最後の確認にチェックを入れてください' : '入力されていない項目があります');
      return;
    }

    sending = true;
    const btn = form.querySelector('.fb-submit');
    btn.disabled = true;
    btn.textContent = '送信しています…';
    try {
      await feedback.send(report);
      await draft?.done();
      ui.toast('送信しました');
      await onSent?.();
    } catch (err) {
      ui.toast(err instanceof FeedbackError ? err.message : '送信できませんでした');
      btn.disabled = false;
      btn.textContent = '送信する';
    } finally {
      sending = false;
    }
  });

  return () => draft?.dispose();
}
