// electron/preload.ts
// レンダラープロセス（React）とメインプロセス（Node.js）の安全な仲介を行うプリロードスクリプト。

import { contextBridge, ipcRenderer, webUtils } from 'electron';

// レンダラー側に公開するAPIの定義
contextBridge.exposeInMainWorld('electronAPI', {
  // Fileオブジェクトから絶対パスを取得 (Electron 32以降対応)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // フォルダをエクスプローラーで開く
  openFolder: (folderPath: string) => ipcRenderer.invoke('folder:open', folderPath),

  // アプリ設定のロード
  loadConfig: () => ipcRenderer.invoke('config:load'),

  // アプリ設定の保存
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),

  // フォルダ選択ダイアログの表示
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),

  // フォルダ内の子ディレクトリを検索
  scanFolders: (parentPath: string) => ipcRenderer.invoke('folder:scan', parentPath),

  // パスの存在チェック
  checkPathExists: (folderPath: string) => ipcRenderer.invoke('folder:check-exists', folderPath),

  // ファイル・フォルダのコピー（アップロード）開始
  copyFiles: (files: string[], targetPath: string, action?: 'copy' | 'move') => 
    ipcRenderer.invoke('file:copy-start', files, targetPath, action),

  // クリップボードのアクション（コピー or 移動）の取得
  getClipboardAction: () => ipcRenderer.invoke('clipboard:get-action'),

  // コピー進捗イベントの受信登録
  onCopyProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('file:copy-progress', callback);
    return () => {
      ipcRenderer.removeListener('file:copy-progress', callback);
    };
  },

  // 競合（同名ファイル存在）検知イベントの受信登録
  onCopyConflict: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('file:copy-conflict', callback);
    return () => {
      ipcRenderer.removeListener('file:copy-conflict', callback);
    };
  },

  // 競合解決アクションの送信（レンダラーからメインへ結果を返す）
  resolveConflict: (resolution: { action: 'overwrite' | 'skip' | 'rename'; applyToAll: boolean }) => 
    ipcRenderer.invoke('file:resolve-conflict', resolution),

  // 最前面表示の切り替え
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),

  // アプリを終了する
  closeApp: () => ipcRenderer.invoke('window:close'),

  // --- アップデート関連 API ---
  // アプリバージョン取得
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  // アップデート確認
  checkForUpdate: () => ipcRenderer.invoke('app:check-update'),
  // アップデートのダウンロード開始
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  // アップデート適用再起動
  quitAndInstall: () => ipcRenderer.invoke('app:quit-and-install'),
  // アップデートステータスの購読
  onUpdateStatus: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('update:status', callback);
    return () => {
      ipcRenderer.removeListener('update:status', callback);
    };
  },
});

