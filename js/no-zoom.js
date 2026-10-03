// ピンチ・ダブルタップで画面がズームしないようにする
// ・Android(Chrome):index.html の viewport(user-scalable=no)で止まる
// ・iPhone(Safari・ホーム画面のアプリ):viewport の指定ではピンチが止まらないので、
//   Safari 独自の gesture イベントと、2本指の動きを止める
// ・ダブルタップ:css の touch-action: manipulation で止める(iOS 13 以降)
// ・入力欄をタップしたときの自動ズーム:入力欄の文字を 16px 以上にし、viewport の maximum-scale=1 でも止める

const stop = (e) => e.preventDefault();
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, stop, { passive: false });
}
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
