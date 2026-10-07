// アプリ全体の設定値

export const APP_ID = 'yururi-diary';
export const APP_NAME = 'ゆる〜り日記🥰';
export const APP_SHORT_NAME = 'ゆる〜り日記';
export const APP_VERSION = self.APP_VERSION;

// 古いアドレス(creative-hues.github.io)では、IndexedDB・Cache Storage・localStorage がアドレス全体で共有される
// (同じアカウントの他アプリ、例:ひとつやね と同じ置き場)。名前は必ずアプリ固有にする。
export const DB_NAME = 'yururi-diary';
export const STORAGE_PREFIX = 'yururi-diary:';

// 機能スイッチ
export const FEATURES = {
  feedback: false, // 不具合報告機能(退院まではオフ)。true にするだけで使える
};

// 不具合報告の中継サーバー(feedback-relay)の URL。公開してよい URL で、秘密の値ではない。
// トークンなどはここに書かない(中継サーバーの Cloudflare の Secret にだけ置く)。
export const FEEDBACK_RELAY_URL = 'https://feedback-relay.creative-hues.workers.dev';

// バックアップファイルの形式バージョン(ファイルの構造を変えたら上げる)
export const BACKUP_FORMAT = 1;

// ---- 引っ越し(古いアドレス → 新しいアドレス)。説明は docs/move.md ----
// 古いアドレスは同じアカウントの他アプリと保存場所を共有していて、他アプリのデータを消したときに
// こちらの記録まで消えたため、このアプリ専用のアドレス(Cloudflare Pages)に移す。
// localhost(PC での確認用)では、8123番を古いアドレス、8124番を新しいアドレスとして扱う。
const LOCAL = self.location?.hostname === 'localhost';
export const OLD_ORIGIN = LOCAL ? 'http://localhost:8123' : 'https://creative-hues.github.io';
export const NEW_ORIGIN = LOCAL ? 'http://localhost:8124' : 'https://yururi-diary.pages.dev';
export const NEW_URL = `${NEW_ORIGIN}/`;
// 'old' … 古いアドレスで開いている / 'new' … 新しいアドレス / 'other' … それ以外(プレビューなど)
export const SITE = self.location?.origin === OLD_ORIGIN ? 'old' : self.location?.origin === NEW_ORIGIN ? 'new' : 'other';
// true にすると、古いアドレスのアプリを開いたときに引っ越しの画面を出す(本番の引っ越しの日に切りかえる)。
// false の間も、古いアドレスに「?move」を付けて開けば、そのタブの中だけ引っ越しの画面を試せる(リハーサル用)。
export const MOVE_OPEN = false;
