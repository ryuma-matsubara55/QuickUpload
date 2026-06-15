"use strict";
// electron/main.ts
// Electronのメインプロセス。ウィンドウ管理、IPC通信処理、ファイルコピーなどのバックエンド処理を担当。
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const electron_updater_1 = require("electron-updater");
let mainWindow = null;
const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;
function getStartupPosition() {
    try {
        const cursorPoint = electron_1.screen.getCursorScreenPoint();
        const activeDisplay = electron_1.screen.getDisplayNearestPoint(cursorPoint) || electron_1.screen.getPrimaryDisplay();
        const { x, y, width, height } = activeDisplay.workArea;
        const startX = x + width - MIN_WINDOW_WIDTH;
        const startY = y;
        return {
            x: Math.max(startX, x),
            y: startY,
        };
    }
    catch {
        return { x: 0, y: 0 };
    }
}
// 設定ファイルの保存パス (%APPDATA%/quick-upload-config.json)
const getConfigPath = () => {
    return path.join(electron_1.app.getPath('userData'), 'quick-upload-config.json');
};
// 競合解決用の一時Promiseリゾルバ
let conflictResolver = null;
let activeConflictResolution = null;
// ウィンドウ作成関数
function createWindow() {
    const { x, y } = getStartupPosition();
    mainWindow = new electron_1.BrowserWindow({
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
    electron_1.Menu.setApplicationMenu(null);
    mainWindow.removeMenu();
    mainWindow.setMenuBarVisibility(false);
    // 開発環境と本番環境でロード先を切り替え
    if (electron_1.app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    else {
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
electron_updater_1.autoUpdater.autoDownload = false;
// ダウンロード済みアップデートを即座に適用しない（ユーザーが確認後に適用）
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
/**
 * アップデートステータスをレンダラーに通知するヘルパー
 */
function sendUpdateStatus(status, payload) {
    if (mainWindow) {
        mainWindow.webContents.send('update:status', { status, ...payload });
    }
}
/** アップデート確認・ダウンロード関連イベントの設定 */
function setupAutoUpdater() {
    // アップデート確認開始
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        sendUpdateStatus('checking');
    });
    // アップデートあり
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        sendUpdateStatus('available', { version: info.version, releaseNotes: info.releaseNotes });
    });
    // 最新版
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        sendUpdateStatus('not-available');
    });
    // ダウンロード進捗
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        sendUpdateStatus('downloading', {
            percent: Math.round(progress.percent),
            transferred: progress.transferred,
            total: progress.total,
        });
    });
    // ダウンロード完了
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        sendUpdateStatus('downloaded', { version: info.version });
    });
    // エラー（オフライン等）→ エラーは出さずにスキップ
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.warn('autoUpdater エラー（オフライン等の可能性）:', err.message);
        sendUpdateStatus('error');
    });
}
// アプリの初期化
electron_1.app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// --- IPC ハンドラーの実装 ---
// 0. アプリのバージョンを取得
electron_1.ipcMain.handle('app:get-version', () => {
    return electron_1.app.getVersion();
});
// 0-1. アップデートを確認する（パッケージ化された本番環境でのみ動作）
electron_1.ipcMain.handle('app:check-update', async () => {
    if (!electron_1.app.isPackaged) {
        // 開発環境・オフライン時はスキップ
        sendUpdateStatus('dev-mode');
        return;
    }
    try {
        await electron_updater_1.autoUpdater.checkForUpdates();
    }
    catch {
        // オフライン等のエラーはユーザーに見せずにスキップ
        sendUpdateStatus('error');
    }
});
// 0-2. アップデートのダウンロードを開始する
electron_1.ipcMain.handle('app:download-update', async () => {
    if (!electron_1.app.isPackaged)
        return;
    try {
        await electron_updater_1.autoUpdater.downloadUpdate();
    }
    catch {
        sendUpdateStatus('error');
    }
});
// 0-3. ダウンロード済みアップデートを適用してアプリを再起動する
electron_1.ipcMain.handle('app:quit-and-install', () => {
    electron_updater_1.autoUpdater.quitAndInstall();
});
// 1. 設定データのロード
electron_1.ipcMain.handle('config:load', async () => {
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
    }
    catch (error) {
        console.error('設定のロードに失敗しました:', error);
        return { items: [], history: [] };
    }
});
// 2. 設定データの保存
electron_1.ipcMain.handle('config:save', async (_, config) => {
    try {
        const configPath = getConfigPath();
        await fs.writeJson(configPath, config, { spaces: 2 });
        return { success: true };
    }
    catch (error) {
        console.error('設定の保存に失敗しました:', error);
        return { success: false, error: error.message };
    }
});
// 3. フォルダ選択ダイアログの表示
electron_1.ipcMain.handle('dialog:select-folder', async () => {
    if (!mainWindow)
        return null;
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});
// 4. 指定フォルダ直下の子フォルダ一覧をスキャン
electron_1.ipcMain.handle('folder:scan', async (_, parentPath) => {
    try {
        if (!(await fs.pathExists(parentPath))) {
            return [];
        }
        const files = await fs.readdir(parentPath);
        const subfolders = [];
        for (const file of files) {
            const fullPath = path.join(parentPath, file);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                subfolders.push(file); // フォルダ名のみを返す
            }
        }
        return subfolders;
    }
    catch (error) {
        console.error('フォルダのスキャンに失敗しました:', error);
        return [];
    }
});
// 5. フォルダの存在確認
electron_1.ipcMain.handle('folder:check-exists', async (_, folderPath) => {
    try {
        return await fs.pathExists(folderPath);
    }
    catch {
        return false;
    }
});
// 5.5. フォルダをエクスプローラーで開く
electron_1.ipcMain.handle('folder:open', async (_, folderPath) => {
    try {
        if (await fs.pathExists(folderPath)) {
            await electron_1.shell.openPath(folderPath);
            return { success: true };
        }
        return { success: false, error: 'コピー先フォルダが存在しません。' };
    }
    catch (error) {
        console.error('フォルダのオープンに失敗しました:', error);
        return { success: false, error: error.message };
    }
});
// 5.6. クリップボードのPreferred DropEffectからコピーか移動かを判定する
electron_1.ipcMain.handle('clipboard:get-action', async () => {
    try {
        const buffer = electron_1.clipboard.readBuffer('Preferred DropEffect');
        if (buffer && buffer.length > 0) {
            const effect = buffer.readInt32LE(0);
            // 2 = MOVE (切り取り/移動), 1 = COPY (コピー)
            if (effect === 2) {
                return 'move';
            }
        }
    }
    catch (error) {
        console.error('クリップボードアクションの取得に失敗しました:', error);
    }
    return 'copy'; // デフォルトはコピー
});
// 6. 最前面表示の切り替え
electron_1.ipcMain.handle('window:set-always-on-top', async (_, flag) => {
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(flag);
        return true;
    }
    return false;
});
// 7. アプリ終了
electron_1.ipcMain.handle('window:close', async () => {
    electron_1.app.quit();
});
// 8. 競合解決の応答受信
electron_1.ipcMain.handle('file:resolve-conflict', async (_, resolution) => {
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
electron_1.ipcMain.handle('file:copy-start', async (event, files, targetPath, action) => {
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
                let resolution;
                // すべてに適用が選ばれていない、または初回競合時はダイアログ（IPC通信）で確認
                if (!activeConflictResolution) {
                    shouldCopy = false; // 一時停止
                    const resolutionPromise = new Promise((resolve) => {
                        conflictResolver = resolve;
                    });
                    // レンダラーに競合を通知
                    event.sender.send('file:copy-conflict', { filename: name, isDirectory });
                    // レンダラーからの応答を待つ
                    resolution = await resolutionPromise;
                }
                else {
                    resolution = activeConflictResolution;
                }
                if (resolution.action === 'skip') {
                    shouldCopy = false;
                }
                else if (resolution.action === 'rename') {
                    // 「元ファイル名_重複のためコピー.ext」などの別名規則を実装
                    copyDest = generateUniqueName(targetPath, name, isDirectory);
                    shouldCopy = true;
                }
                else if (resolution.action === 'overwrite') {
                    shouldCopy = true;
                }
            }
            if (shouldCopy) {
                if (isMove) {
                    // 移動実行 (フォルダ・ファイルの中身ごと移動)
                    await fs.move(srcPath, copyDest, { overwrite: true });
                }
                else {
                    // コピー実行 (フォルダの場合は中身ごとコピー)
                    await fs.copy(srcPath, copyDest, { overwrite: true });
                }
                successCount++;
            }
            else {
                failCount++; // スキップされた場合も失敗/未処理扱いとするか、あるいはスキップ件数として扱う。
                // 要件:「コピー完了後、成功件数・失敗件数を表示」
                // ここでは成功以外のスキップもfailCountにカウントするか、あるいは成功件数に含めない。
            }
        }
        catch (err) {
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
function generateUniqueName(dir, filename, isDirectory) {
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
    }
    else {
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
