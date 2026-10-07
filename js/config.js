// アプリ全体の設定値

export const APP_ID = 'yururi-diary';
export const APP_NAME = 'ゆる〜り日記🥰';
export const APP_SHORT_NAME = 'ゆる〜り日記';
export const APP_VERSION = self.APP_VERSION;

// IndexedDB・Cache Storage・localStorage は「creative-hues.github.io」全体で共有される
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
