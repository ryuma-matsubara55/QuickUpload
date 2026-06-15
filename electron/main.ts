// electron/main.ts
// Electronのメインプロセス。ウィンドウ管理、IPC通信処理、ファイルコピーなどのバックエンド処理を担当。

import { app, BrowserWindow, dialog, ipcMain, shell, clipboard, Menu, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;

function getStartupPosition() {
  try {
    const cursorPoint = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay();
    const { x, y, width, height } = activeDisplay.workArea;
    const startX = x + width - MIN_WINDOW_WIDTH;
    const startY = y;
    return {
      x: Math.max(startX, x),
      y: startY,
    };
  } catch {
    return { x: 0, y: 0 };
  }
}

// 設定ファイルの保存パス (%APPDATA%/quick-upload-config.json)
const getConfigPath = () => {
  return path.join(app.getPath('userData'), 'quick-upload-config.json');
};

// 競合解決用の一時Promiseリゾルバ
let conflictResolver: ((value: any) => void) | null = null;
let activeConflictResolution: { action: 'overwrite' | 'skip' | 'rename'; applyToAll: boolean } | null = null;

// ウィンドウ作成関数
function createWindow() {
  const { x, y } = getStartupPosition();

  mainWindow = new BrowserWindow({
    x,
    y,
    width: MIN_WINDOW_WIDTH,
    height: MIN_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    alwaysOnTop: true, // デフォルトで最前面表示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'クイックアップロード支援アプリ',
  });

  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  // 開発環境と本番環境でロード先を切り替え
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Viteのバインド先変更(127.0.0.1)に合わせてロード先も変更
    mainWindow.loadURL('http://127.0.0.1:5173');
    // 開発時はデベロッパーツールを自動で開かないようにする（必要に応じて手動で開く）
    // mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- autoUpdater の設定 ---
// 自動ダウンロードは無効にし、ユーザーが「今すぐダウンロード」を選んだ時のみダウンロードする
autoUpdater.autoDownload = false;
// ダウンロード済みアップデートを即座に適用しない（ユーザーが確認後に適用）
autoUpdater.autoInstallOnAppQuit = true;

/**
 * アップデートステータスをレンダラーに通知するヘルパー
 */
function sendUpdateStatus(status: string, payload?: any) {
  if (mainWindow) {
    mainWindow.webContents.send('update:status', { status, ...payload });
  }
}

/** アップデート確認・ダウンロード関連イベントの設定 */
function setupAutoUpdater() {
  // アップデート確認開始
  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking');
  });

  // アップデートあり
  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', { version: info.version, releaseNotes: info.releaseNotes });
  });

  // 最新版
  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus('not-available');
  });

  // ダウンロード進捗
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // ダウンロード完了
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('downloaded', { version: info.version });
  });

  // エラー（オフライン等）→ エラーは出さずにスキップ
  autoUpdater.on('error', (err) => {
    console.warn('autoUpdater エラー（オフライン等の可能性）:', err.message);
    sendUpdateStatus('error');
  });
}

// アプリの初期化
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC ハンドラーの実装 ---

// 0. アプリのバージョンを取得
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// 0-1. アップデートを確認する（パッケージ化された本番環境でのみ動作）
ipcMain.handle('app:check-update', async () => {
  if (!app.isPackaged) {
    // 開発環境・オフライン時はスキップ
    sendUpdateStatus('dev-mode');
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // オフライン等のエラーはユーザーに見せずにスキップ
    sendUpdateStatus('error');
  }
});

// 0-2. アップデートのダウンロードを開始する
ipcMain.handle('app:download-update', async () => {
  if (!app.isPackaged) return;
  try {
    await autoUpdater.downloadUpdate();
  } catch {
    sendUpdateStatus('error');
  }
});

// 0-3. ダウンロード済みアップデートを適用してアプリを再起動する
ipcMain.handle('app:quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// 1. 設定データのロード
ipcMain.handle('config:load', async () => {

  try {
    const configPath = getConfigPath();
    if (await fs.pathExists(configPath)) {
      const data = await fs.readJson(configPath);
      return data;
    }
    // 初期設定データ
    return {
      items: [],
      history: [],
    };
  } catch (error) {
    console.error('設定のロードに失敗しました:', error);
    return { items: [], history: [] };
  }
});

// 2. 設定データの保存
ipcMain.handle('config:save', async (_, config: any) => {
  try {
    const configPath = getConfigPath();
    await fs.writeJson(configPath, config, { spaces: 2 });
    return { success: true };
  } catch (error) {
    console.error('設定の保存に失敗しました:', error);
    return { success: false, error: (error as Error).message };
  }
});

// 3. フォルダ選択ダイアログの表示
ipcMain.handle('dialog:select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 4. 指定フォルダ直下の子フォルダ一覧をスキャン
ipcMain.handle('folder:scan', async (_, parentPath: string) => {
  try {
    if (!(await fs.pathExists(parentPath))) {
      return [];
    }
    const files = await fs.readdir(parentPath);
    const subfolders: string[] = [];

    for (const file of files) {
      const fullPath = path.join(parentPath, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        subfolders.push(file); // フォルダ名のみを返す
      }
    }
    return subfolders;
  } catch (error) {
    console.error('フォルダのスキャンに失敗しました:', error);
    return [];
  }
});

// 5. フォルダの存在確認
ipcMain.handle('folder:check-exists', async (_, folderPath: string) => {
  try {
    return await fs.pathExists(folderPath);
  } catch {
    return false;
  }
});

// 5.5. フォルダをエクスプローラーで開く
ipcMain.handle('folder:open', async (_, folderPath: string) => {
  try {
    if (await fs.pathExists(folderPath)) {
      await shell.openPath(folderPath);
      return { success: true };
    }
    return { success: false, error: 'コピー先フォルダが存在しません。' };
  } catch (error) {
    console.error('フォルダのオープンに失敗しました:', error);
    return { success: false, error: (error as Error).message };
  }
});

// 5.6. クリップボードのPreferred DropEffectからコピーか移動かを判定する
ipcMain.handle('clipboard:get-action', async () => {
  try {
    const buffer = clipboard.readBuffer('Preferred DropEffect');
    if (buffer && buffer.length > 0) {
      const effect = buffer.readInt32LE(0);
      // 2 = MOVE (切り取り/移動), 1 = COPY (コピー)
      if (effect === 2) {
        return 'move';
      }
    }
  } catch (error) {
    console.error('クリップボードアクションの取得に失敗しました:', error);
  }
  return 'copy'; // デフォルトはコピー
});

// 6. 最前面表示の切り替え
ipcMain.handle('window:set-always-on-top', async (_, flag: boolean) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag);
    return true;
  }
  return false;
});

// 7. アプリ終了
ipcMain.handle('window:close', async () => {
  app.quit();
});

// 8. 競合解決の応答受信
ipcMain.handle('file:resolve-conflict', async (_, resolution: { action: 'overwrite' | 'skip' | 'rename'; applyToAll: boolean }) => {
  if (conflictResolver) {
    if (resolution.applyToAll) {
      activeConflictResolution = resolution;
    }
    conflictResolver(resolution);
    conflictResolver = null;
  }
  return true;
});

// 9. ファイル・フォルダコピー（アップロード）処理
ipcMain.handle('file:copy-start', async (event, files: string[], targetPath: string, action?: 'copy' | 'move') => {
  const isMove = action === 'move';
  activeConflictResolution = null; // 競合解決ステートをリセット
  let successCount = 0;
  let failCount = 0;
  const total = files.length;

  // コピー先が存在するか確認
  if (!(await fs.pathExists(targetPath))) {
    return { success: false, error: 'アップロード先フォルダが存在しません。' };
  }

  for (let i = 0; i < total; i++) {
    const srcPath = files[i];
    const name = path.basename(srcPath);
    const destPath = path.join(targetPath, name);

    // 進捗の通知
    event.sender.send('file:copy-progress', {
      currentFile: name,
      currentIndex: i + 1,
      total,
      percentage: Math.round((i / total) * 100),
    });

    try {
      if (!(await fs.pathExists(srcPath))) {
        failCount++;
        continue;
      }

      const isDirectory = (await fs.stat(srcPath)).isDirectory();
      let copyDest = destPath;
      let shouldCopy = true;

      // コピー先が既に存在する場合の競合チェック
      if (await fs.pathExists(destPath)) {
        let resolution: { action: 'overwrite' | 'skip' | 'rename'; applyToAll: boolean };

        // すべてに適用が選ばれていない、または初回競合時はダイアログ（IPC通信）で確認
        if (!activeConflictResolution) {
          shouldCopy = false; // 一時停止
          const resolutionPromise = new Promise<{ action: 'overwrite' | 'skip' | 'rename'; applyToAll: boolean }>((resolve) => {
            conflictResolver = resolve;
          });

          // レンダラーに競合を通知
          event.sender.send('file:copy-conflict', { filename: name, isDirectory });

          // レンダラーからの応答を待つ
          resolution = await resolutionPromise;
        } else {
          resolution = activeConflictResolution;
        }

        if (resolution.action === 'skip') {
          shouldCopy = false;
        } else if (resolution.action === 'rename') {
          // 「元ファイル名_重複のためコピー.ext」などの別名規則を実装
          copyDest = generateUniqueName(targetPath, name, isDirectory);
          shouldCopy = true;
        } else if (resolution.action === 'overwrite') {
          shouldCopy = true;
        }
      }

      if (shouldCopy) {
        if (isMove) {
          // 移動実行 (フォルダ・ファイルの中身ごと移動)
          await fs.move(srcPath, copyDest, { overwrite: true });
        } else {
          // コピー実行 (フォルダの場合は中身ごとコピー)
          await fs.copy(srcPath, copyDest, { overwrite: true });
        }
        successCount++;
      } else {
        failCount++; // スキップされた場合も失敗/未処理扱いとするか、あるいはスキップ件数として扱う。
        // 要件:「コピー完了後、成功件数・失敗件数を表示」
        // ここでは成功以外のスキップもfailCountにカウントするか、あるいは成功件数に含めない。
      }
    } catch (err) {
      console.error('コピーエラー:', err);
      failCount++;
    }
  }

  // 完了通知
  event.sender.send('file:copy-progress', {
    currentFile: '',
    currentIndex: total,
    total,
    percentage: 100,
  });

  return { success: true, successCount, failCount };
});

/**
 * 重複しないユニークな別名を生成するヘルパー関数
 * @param dir コピー先フォルダ
 * @param filename 元のファイル名
 * @param isDirectory フォルダかどうか
 */
function generateUniqueName(dir: string, filename: string, isDirectory: boolean): string {
  if (isDirectory) {
    // フォルダの場合
    let newName = `${filename}_重複のためコピー`;
    let dest = path.join(dir, newName);
    let counter = 1;
    while (fs.existsSync(dest)) {
      newName = `${filename}_重複のためコピー_${counter}`;
      dest = path.join(dir, newName);
      counter++;
    }
    return dest;
  } else {
    // ファイルの場合
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let newName = `${base}_重複のためコピー${ext}`;
    let dest = path.join(dir, newName);
    let counter = 1;
    while (fs.existsSync(dest)) {
      newName = `${base}_重複のためコピー_${counter}${ext}`;
      dest = path.join(dir, newName);
      counter++;
    }
    return dest;
  }
}
