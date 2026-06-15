// src/App.tsx
// クイックアップロード支援アプリのメインUIコンポーネント。状態管理とイベントリスナーの登録を行います。

import { useState, useEffect } from 'react';
import type { Item, HistoryLog } from './types';
import { Sidebar } from './components/Sidebar';
import { UploadArea } from './components/UploadArea';
import { HistoryArea } from './components/HistoryArea';
import { SettingModal } from './components/SettingModal';
import { ConflictDialog } from './components/ConflictDialog';
import { UpdateNotification } from './components/UpdateNotification';
import type { UpdateState } from './components/UpdateNotification';
import { Pin, X, FolderSync } from 'lucide-react';
import './App.css';

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [activeItemId, setActiveItemId] = useState<string>('');

  // 各種表示・動作制御用ステート
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true); // デフォルトで最前面固定
  const [progress, setProgress] = useState<{ currentFile: string; currentIndex: number; total: number; percentage: number } | null>(null);
  const [copyResult, setCopyResult] = useState<{ success: boolean; successCount: number; failCount: number } | null>(null);
  const [appVersion, setAppVersion] = useState<string>('0.1.0');
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });

  // 競合状態管理
  const [conflictInfo, setConflictInfo] = useState<{ filename: string; isDirectory: boolean } | null>(null);

  // 1. アプリ起動時のデータ初期ロード
  useEffect(() => {
    const loadAppData = async () => {
      if (!window.electronAPI) {
        console.warn('Electron環境が検出されませんでした。Webブラウザデモモード（localStorage保存）で起動します。');
        const saved = localStorage.getItem('quick-upload-config');
        let initialItems: Item[] = [];
        let initialHistory: HistoryLog[] = [];

        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            initialItems = parsed.items || [];
            initialHistory = parsed.history || [];
          } catch (e) {
            console.error('保存された設定のパースに失敗しました:', e);
          }
        }

        // 保存データが空の場合はデフォルトのデモ項目を作成
        if (initialItems.length === 0) {
          initialItems = [
            {
              id: 'demo-1',
              name: 'A案件 (デモ用項目)',
              parentPath: 'C:\\Desktop\\Project_A',
              folderPaths: ['図面フォルダ', '図面フォルダ\\意匠図面', '図面フォルダ\\構造図面', '現場写真', '現場写真\\着工前', '現場写真\\施工中', '現場写真\\完了', '検査データ'],
              order: 1,
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'demo-2',
              name: '見積フォルダ (デモ用項目)',
              parentPath: 'D:\\Dropbox\\Estimates_2026',
              folderPaths: ['顧客送付済', '承認待ち'],
              order: 2,
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          ];
          localStorage.setItem('quick-upload-config', JSON.stringify({ items: initialItems, history: [] }));
        }

        setItems(initialItems);
        setHistory(initialHistory);
        const firstEnabled = initialItems.find((item) => item.enabled);
        if (firstEnabled) {
          setActiveItemId(firstEnabled.id);
        }
        return;
      }

      const config = await window.electronAPI.loadConfig();
      if (config) {
        setItems(config.items || []);
        setHistory(config.history || []);

        // 有効な最初の項目をアクティブにする
        const firstEnabled = (config.items || []).find((item: Item) => item.enabled);
        if (firstEnabled) {
          setActiveItemId(firstEnabled.id);
        }
      }

      // バージョン情報の取得
      const version = await window.electronAPI.getAppVersion();
      if (version) {
        setAppVersion(version);
      }

      // 最前面固定の初期状態をメインプロセスに通知
      await window.electronAPI.setAlwaysOnTop(true);

      // 自動アップデートの確認（起動時）
      window.electronAPI.checkForUpdate().catch(() => {
        // オフライン・エラー等はサイレントでスキップ
      });
    };

    loadAppData();
  }, []);

  // 1-2. アップデートステータス通知の受信
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribeUpdate = window.electronAPI.onUpdateStatus((_, data) => {
      setUpdateState((prev) => ({
        ...prev,
        status: data.status,
        version: data.version || prev.version,
        percent: data.percent !== undefined ? data.percent : prev.percent,
      }));
    });

    return () => {
      unsubscribeUpdate();
    };
  }, []);

  // 2. メインプロセスからのコピー進捗通知の受信
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribeProgress = window.electronAPI.onCopyProgress((_, data) => {
      setProgress(data);
      if (data.percentage === 100) {
        // 完了時は表示を少し残してから消す
        setTimeout(() => {
          setProgress(null);
        }, 1500);
      }
    });

    return () => {
      unsubscribeProgress();
    };
  }, []);

  // 3. メインプロセスからの競合検知通知の受信
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribeConflict = window.electronAPI.onCopyConflict((_, data) => {
      setConflictInfo(data);
    });

    return () => {
      unsubscribeConflict();
    };
  }, []);

  // アクティブな項目オブジェクトの取得
  const activeItem = items.find((item) => item.id === activeItemId) || null;

  // 項目切り替え時のコピー結果をリセット
  const handleSelectActiveItem = (id: string) => {
    setActiveItemId(id);
    setCopyResult(null);
  };

  // 最前面表示の切り替え
  const toggleAlwaysOnTop = async () => {
    const nextState = !isAlwaysOnTop;
    if (!window.electronAPI) {
      setIsAlwaysOnTop(nextState);
      return;
    }
    const success = await window.electronAPI.setAlwaysOnTop(nextState);
    if (success) {
      setIsAlwaysOnTop(nextState);
    }
  };

  // 手動アップデート確認
  const handleCheckUpdate = () => {
    setUpdateState({ status: 'checking' });
    if (!window.electronAPI) {
      setTimeout(() => {
        setUpdateState({ status: 'dev-mode' });
      }, 800);
      return;
    }
    window.electronAPI.checkForUpdate().catch(() => {
      setUpdateState({ status: 'error' });
    });
  };

  // アップデートダウンロードの開始
  const handleDownloadUpdate = () => {
    setUpdateState((prev) => ({ ...prev, status: 'downloading', percent: 0 }));
    if (window.electronAPI) {
      window.electronAPI.downloadUpdate().catch(() => {
        setUpdateState({ status: 'error' });
      });
    }
  };

  // アップデート適用の再起動
  const handleInstallUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.quitAndInstall();
    }
  };

  // ファイルコピー・移動（アップロード）開始処理
  const handleCopyStart = async (files: string[], targetPath: string, action: 'copy' | 'move' = 'copy') => {
    setCopyResult(null);
    const prepareMsg = action === 'move' ? '移動の準備中...' : 'コピーの準備中...';
    setProgress({ currentFile: prepareMsg, currentIndex: 0, total: files.length, percentage: 0 });

    if (!window.electronAPI) {
      // Webデモ環境でのシミュレーションコピー
      const total = files.length;
      for (let i = 0; i < total; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setProgress({
          currentFile: files[i].split('\\').pop() || files[i],
          currentIndex: i + 1,
          total,
          percentage: Math.round(((i + 1) / total) * 100),
        });
      }

      setTimeout(async () => {
        setProgress(null);
        const res = { success: true, successCount: total, failCount: 0 };
        setCopyResult(res);

        if (activeItem) {
          const newHistory: HistoryLog = {
            id: Math.random().toString(36).substring(2, 9),
            itemName: `${activeItem.name}${action === 'move' ? ' (移動)' : ''}`,
            targetPath: targetPath,
            files: files.map((f) => f.split('\\').pop() || f),
            successCount: res.successCount,
            failCount: res.failCount,
            timestamp: new Date().toISOString(),
          };

          const updatedHistory = [newHistory, ...history].slice(0, 100);
          setHistory(updatedHistory);
          localStorage.setItem('quick-upload-config', JSON.stringify({ items, history: updatedHistory }));
        }
      }, 500);
      return;
    }

    try {
      const res = await window.electronAPI.copyFiles(files, targetPath, action);

      if (res.success) {
        setCopyResult(res);

        // 履歴ログを生成・保存
        if (activeItem) {
          const newHistory: HistoryLog = {
            id: Math.random().toString(36).substring(2, 9),
            itemName: `${activeItem.name}${action === 'move' ? ' (移動)' : ''}`,
            targetPath: targetPath,
            files: files.map((f) => f.split('\\').pop() || f),
            successCount: res.successCount,
            failCount: res.failCount,
            timestamp: new Date().toISOString(),
          };

          const updatedHistory = [newHistory, ...history].slice(0, 100); // 最大100件保持
          setHistory(updatedHistory);

          // アプリ設定データを保存
          await window.electronAPI.saveConfig({
            items,
            history: updatedHistory,
          });
        }
      } else {
        setCopyResult({ success: false, successCount: 0, failCount: files.length });
      }
    } catch (error) {
      console.error('コピー実行中に例外が発生しました:', error);
      setCopyResult({ success: false, successCount: 0, failCount: files.length });
    } finally {
      setProgress(null);
    }
  };

  // 競合解決アクションの送信
  const handleResolveConflict = async (action: 'overwrite' | 'skip' | 'rename', applyToAll: boolean) => {
    if (!window.electronAPI) {
      setConflictInfo(null);
      return;
    }
    await window.electronAPI.resolveConflict({ action, applyToAll });
    setConflictInfo(null); // ダイアログを閉じる
  };

  // 履歴クリア処理
  const handleClearHistory = async () => {
    setHistory([]);
    if (!window.electronAPI) {
      localStorage.setItem('quick-upload-config', JSON.stringify({ items, history: [] }));
      return;
    }
    await window.electronAPI.saveConfig({
      items,
      history: [],
    });
  };

  // 項目設定データの保存
  const handleSaveItems = async (updatedItems: Item[]) => {
    setItems(updatedItems);
    if (!window.electronAPI) {
      localStorage.setItem('quick-upload-config', JSON.stringify({ items: updatedItems, history }));
    } else {
      await window.electronAPI.saveConfig({
        items: updatedItems,
        history,
      });
    }

    // 現在選択中のアクティブ項目が削除または無効化された場合のハンドリング
    const exists = updatedItems.find((item) => item.id === activeItemId && item.enabled);
    if (!exists) {
      const firstEnabled = updatedItems.find((item) => item.enabled);
      handleSelectActiveItem(firstEnabled ? firstEnabled.id : '');
    }
  };

  // アプリ終了
  const handleCloseApp = () => {
    if (!window.electronAPI) {
      alert('ブラウザ環境のためアプリを終了できません。Electronで実行してください（npm run electron:dev）。');
      return;
    }
    window.electronAPI.closeApp();
  };

  return (
    <div className="app-container">
      {/* 左カラム: サイドバー */}
      <Sidebar
        items={items}
        activeItemId={activeItemId}
        onSelectActiveItem={handleSelectActiveItem}
        onOpenSettings={() => setIsSettingsOpen(true)}
        appVersion={appVersion}
        onCheckUpdate={handleCheckUpdate}
      />

      {/* 右カラム: メイン表示エリア */}
      <main className="main-content">
        {/* ヘッダー */}
        <header className="header">
          <h1 className="header-title">
            <FolderSync size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>{activeItem ? activeItem.name : '項目未選択'}</span>
          </h1>

          <div className="header-controls">
            {/* 最前面固定ON/OFF */}
            <button
              className={`always-on-top-btn ${isAlwaysOnTop ? 'active' : ''}`}
              onClick={toggleAlwaysOnTop}
              title="最前面表示のON/OFF"
            >
              <Pin size={14} style={{ transform: isAlwaysOnTop ? 'rotate(45deg)' : 'none' }} />
              <span>最前面{isAlwaysOnTop ? '固定中' : '解除'}</span>
            </button>

            {/* 終了ボタン */}
            <button className="close-btn" onClick={handleCloseApp} title="アプリを終了する">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* コンテンツボディ */}
        <div className="content-body">
          {/* ドラッグ＆ドロップエリア（フォルダ選択UIを内包） */}
          <UploadArea
            activeItem={activeItem}
            onCopyStart={handleCopyStart}
            progress={progress}
            copyResult={copyResult}
          />

          {/* アップロード履歴エリア */}
          <HistoryArea history={history} onClearHistory={handleClearHistory} />
        </div>
      </main>

      {/* 設定モーダル */}
      <SettingModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        items={items}
        onSaveItems={handleSaveItems}
      />

      {/* 競合解決ダイアログ */}
      {conflictInfo && (
        <ConflictDialog
          isOpen={!!conflictInfo}
          filename={conflictInfo.filename}
          isDirectory={conflictInfo.isDirectory}
          onResolve={handleResolveConflict}
        />
      )}

      {/* アップデート通知ダイアログ */}
      <UpdateNotification
        updateState={updateState}
        onClose={() => setUpdateState({ status: 'idle' })}
        onDownload={handleDownloadUpdate}
        onInstall={handleInstallUpdate}
      />
    </div>
  );
}

export default App;
