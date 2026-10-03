// 不具合報告の部品:「送った報告」一覧(状態・定型文の返信・追記)
// renderSentReports(el, feedback, { newHref, onSeen })
//   newHref … 新しく報告する画面へのリンク
//   onSeen  … 返信を見たあとに呼ぶ(アプリのバッジを消すなど)

import { FeedbackError } from './client.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const STATUS = { received: '受付済み', working: '対応中', done: '完了' };
const KIND = { bug: '不具合', request: '要望' };

function dateText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function renderSentReports(el, feedback, { newHref, onSeen } = {}) {
  const { ui } = feedback.options;
  el.innerHTML = '<p class="fb-loading">読み込んでいます…</p>';
  const { reports, offline } = await feedback.list();
  const newFlags = await Promise.all(reports.map((r) => feedback.isNew(r)));

  el.innerHTML = `
    ${offline ? '<p class="fb-offline">最新の状態を読み込めませんでした。前に読み込んだ内容を出しています。</p>' : ''}
    ${newHref ? `<a class="fb-new-link" href="${newHref}">＋ 新しく報告・要望を送る</a>` : ''}
    ${reports.length ? reports.map((r, i) => `
      <article class="fb-report" data-number="${r.number}">
        <div class="fb-report-head">
          <span class="fb-kind">${KIND[r.kind] ?? ''}</span>
          <span class="fb-status fb-status-${r.status}">${STATUS[r.status] ?? ''}</span>
          ${newFlags[i] ? '<span class="fb-new">新しい返信</span>' : ''}
        </div>
        <h2 class="fb-report-title">${esc(r.title)}</h2>
        <p class="fb-report-date">${dateText(r.createdAt)} に送信</p>
        ${(r.replies ?? []).length ? `
          <ul class="fb-replies">
            ${r.replies.map((rep) => `<li><span class="fb-reply-from">開発者より・${dateText(rep.at)}</span>${esc(rep.text)}</li>`).join('')}
          </ul>` : '<p class="fb-noreply">まだ返信はありません</p>'}
        ${(r.appends ?? []).map((a) => `<p class="fb-append-done"><span class="fb-reply-from">あなたの追記・${dateText(a.at)}</span>${esc(a.text)}</p>`).join('')}
        ${r.canAppend && !offline ? `
          <div class="fb-append">
            <label class="fb-label" for="append-${r.number}">質問へのお返事(1回だけ送れます)</label>
            <textarea class="fb-input" id="append-${r.number}" rows="3" maxlength="2000"></textarea>
            <button type="button" class="fb-submit fb-append-btn">お返事を送る</button>
          </div>` : ''}
      </article>`).join('') : '<p class="fb-empty">まだ送った報告はありません</p>'}
  `;

  if (reports.length) {
    await feedback.markSeen(reports);
    onSeen?.();
  }

  el.querySelectorAll('.fb-append-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      const box = b.closest('.fb-report');
      const text = box.querySelector('textarea').value.trim();
      if (!text) return ui.toast('お返事を書いてください');
      const ok = await ui.confirm({ title: 'お返事を送りますか?', message: '送れるのは1回だけです。', ok: '送る', cancel: 'やめる' });
      if (!ok) return;
      b.disabled = true;
      try {
        await feedback.append(Number(box.dataset.number), text);
        ui.toast('送信しました');
        renderSentReports(el, feedback, { newHref, onSeen });
      } catch (err) {
        ui.toast(err instanceof FeedbackError ? err.message : '送信できませんでした');
        b.disabled = false;
      }
    });
  });
}
