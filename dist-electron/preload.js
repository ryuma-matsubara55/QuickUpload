"use strict";
// electron/preload.ts
// レンダラープロセス（React）とメインプロセス（Node.js）の安全な仲介を行うプリロードスクリプト。
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// レンダラー側に公開するAPIの定義
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Fileオブジェクトから絶対パスを取得 (Electron 32以降対応)
    getPathForFile: (file) => electron_1.webUtils.getPathForFile(file),
    // フォルダをエクスプローラーで開く
    openFolder: (folderPath) => electron_1.ipcRenderer.invoke('folder:open', folderPath),
    // アプリ設定のロード
    loadConfig: () => electron_1.ipcRenderer.invoke('config:load'),
    // アプリ設定の保存
    saveConfig: (config) => electron_1.ipcRenderer.invoke('config:save', config),
    // フォルダ選択ダイアログの表示
    selectFolder: () => electron_1.ipcRenderer.invoke('dialog:select-folder'),
    // フォルダ内の子ディレクトリを検索
    scanFolders: (parentPath) => electron_1.ipcRenderer.invoke('folder:scan', parentPath),
    // パスの存在チェック
    checkPathExists: (folderPath) => electron_1.ipcRenderer.invoke('folder:check-exists', folderPath),
    // ファイル・フォルダのコピー（アップロード）開始
    copyFiles: (files, targetPath, action) => electron_1.ipcRenderer.invoke('file:copy-start', files, targetPath, action),
    // クリップボードのアクション（コピー or 移動）の取得
    getClipboardAction: () => electron_1.ipcRenderer.invoke('clipboard:get-action'),
    // コピー進捗イベントの受信登録
    onCopyProgress: (callback) => {
        electron_1.ipcRenderer.on('file:copy-progress', callback);
        return () => {
            electron_1.ipcRenderer.removeListener('file:copy-progress', callback);
        };
    },
    // 競合（同名ファイル存在）検知イベントの受信登録
    onCopyConflict: (callback) => {
        electron_1.ipcRenderer.on('file:copy-conflict', callback);
        return () => {
            electron_1.ipcRenderer.removeListener('file:copy-conflict', callback);
        };
    },
    // 競合解決アクションの送信（レンダラーからメインへ結果を返す）
    resolveConflict: (resolution) => electron_1.ipcRenderer.invoke('file:resolve-conflict', resolution),
    // 最前面表示の切り替え
    setAlwaysOnTop: (flag) => electron_1.ipcRenderer.invoke('window:set-always-on-top', flag),
    // アプリを終了する
    closeApp: () => electron_1.ipcRenderer.invoke('window:close'),
    // --- アップデート関連 API ---
    // アプリバージョン取得
    getAppVersion: () => electron_1.ipcRenderer.invoke('app:get-version'),
    // アップデート確認
    checkForUpdate: () => electron_1.ipcRenderer.invoke('app:check-update'),
    // アップデートのダウンロード開始
    downloadUpdate: () => electron_1.ipcRenderer.invoke('app:download-update'),
    // アップデート適用再起動
    quitAndInstall: () => electron_1.ipcRenderer.invoke('app:quit-and-install'),
    // アップデートステータスの購読
    onUpdateStatus: (callback) => {
        electron_1.ipcRenderer.on('update:status', callback);
        return () => {
            electron_1.ipcRenderer.removeListener('update:status', callback);
        };
    },
});
