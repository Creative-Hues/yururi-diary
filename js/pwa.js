// Service Worker の登録・更新のお知らせ・ホーム画面への追加・保存の保護

let installPrompt = null;
let updateRequested = false;

export function registerSW(onUpdateReady) {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(reg);
      });
    });
    // アプリに戻ってきたときにも新しい版がないか確かめる
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('service worker registration failed', e));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });
}

export function applyUpdate(reg) {
  updateRequested = true;
  reg.waiting?.postMessage('SKIP_WAITING');
}

// 端末の容量が少ないときにデータが消されないよう、保護をお願いする
export async function requestPersist() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function isPersisted() {
  return (await navigator.storage?.persisted?.()) ?? false;
}

// Android Chrome:「ホーム画面に追加」の案内を自分のボタンから出せる(iPhone にはこの仕組みがない)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});
window.addEventListener('appinstalled', () => { installPrompt = null; });

export const canPromptInstall = () => installPrompt !== null;

export async function promptInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  return outcome === 'accepted';
}
