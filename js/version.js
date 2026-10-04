// アプリのバージョン(不具合報告・更新の判定に使う)
// ※ 公開するたびに必ず数字を上げること。sw.js もこの値でキャッシュを切り替えるため、
//    上げ忘れると Pixel / iPhone に新しい版が届きません。
// 通常の <script> と Service Worker(importScripts)の両方から読むため、ES module にはしない。
self.APP_VERSION = '0.12.0';
