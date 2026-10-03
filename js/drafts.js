// 入力画面の下書き(書きかけ)
// ・入力するたびに自動で保存する(少し待ってから)。アプリから離れたとき・画面を移るときにもすぐ保存する。
// ・新しく記録するときと、すでにある記録を直すときで、別のキーにする(例:'meal:new' / 'meal:edit:<id>')。
// ・次にその画面を開いたら戻して「書きかけを戻しました」と知らせ、「下書きを消す」も選べる。
// ・保存・削除したら消す。
// meta ストアに置くので、バックアップには入らない。ロックがかかっても消えない。

import { getMeta, setMeta, del } from './db.js';
import { confirmDialog, toast } from './ui.js';
import { refresh } from './router.js';
import { nowIso } from './util.js';

const metaKey = (key) => `draft:${key}`;

export const loadDraft = async (key) => (await getMeta(metaKey(key))) ?? null;
export const clearDraft = (key) => del('meta', metaKey(key));

// key       下書きの名前
// root      入力欄が入っている要素(この中の入力・タップで保存する)
// getState  いまの入力内容を返す(JSON にできる形)
// setState  入力内容を画面に戻す
export async function attachDraft({ key, root, getState, setState }) {
  const initial = JSON.stringify(getState()); // 開いたときの内容(これと同じなら下書きは残さない)
  const saved = await loadDraft(key);
  let stopped = false;
  let timer = null;

  const persist = async () => {
    clearTimeout(timer);
    if (stopped) return;
    const state = getState();
    if (JSON.stringify(state) === initial) await clearDraft(key);
    else await setMeta(metaKey(key), { value: state, savedAt: nowIso() });
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(persist, 400);
  };

  if (saved && JSON.stringify(saved.value) !== initial) {
    setState(saved.value);
    showBar(root, async () => {
      if (!(await confirmDialog({ title: '下書きを消しますか?', message: '書きかけの内容は消えて、もとの状態にもどります。', ok: '消す', danger: true }))) return;
      stopped = true;
      clearTimeout(timer);
      await clearDraft(key);
      toast('下書きを消しました');
      refresh();
    });
    toast('書きかけを戻しました');
  }

  // 入力欄の入力に加えて、ボタン(朝昼晩・チップ・つらさなど)のタップでも保存する
  root.addEventListener('input', schedule);
  root.addEventListener('change', schedule);
  root.addEventListener('click', schedule);
  const onHide = () => { if (document.visibilityState === 'hidden') persist(); };
  document.addEventListener('visibilitychange', onHide);

  const detach = () => {
    root.removeEventListener('input', schedule);
    root.removeEventListener('change', schedule);
    root.removeEventListener('click', schedule);
    document.removeEventListener('visibilitychange', onHide);
  };

  return {
    // 保存・削除・送信が終わったとき:下書きを消す
    async done() {
      stopped = true;
      clearTimeout(timer);
      detach();
      await clearDraft(key);
    },
    // 画面を離れるとき:最新の内容を保存して終わる
    dispose() {
      detach();
      persist();
    },
  };
}

function showBar(root, onDiscard) {
  const bar = document.createElement('div');
  bar.className = 'draft-bar';
  bar.innerHTML = '<span>書きかけを戻しました</span><button type="button" class="btn btn-small">下書きを消す</button>';
  bar.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation(); // 下書きの保存のきっかけにしない
    onDiscard();
  });
  root.prepend(bar);
}

// 名前の付いた入力欄(input・textarea・select・チェックボックス)の内容を、下書き用に読み書きする
export function namedFields(root, names) {
  const field = (n) => root.querySelector(`[name="${n}"]`);
  return {
    get() {
      return Object.fromEntries(names.map((n) => {
        const f = field(n);
        return [n, f?.type === 'checkbox' ? f.checked : f?.value ?? ''];
      }));
    },
    set(v) {
      for (const n of names) {
        const f = field(n);
        if (!f || !(n in v)) continue;
        if (f.type === 'checkbox') f.checked = !!v[n];
        else f.value = v[n];
      }
    },
  };
}
