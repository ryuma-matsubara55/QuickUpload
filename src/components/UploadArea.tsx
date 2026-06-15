// src/components/UploadArea.tsx
// ファイル/フォルダのドラッグ＆ドロップ受け入れ、階層ボタン選択、進捗・完了結果を表示するコンポーネント。

import React, { useState } from 'react';
import type { Item } from '../types';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, FolderOpen, ChevronRight, Home, ExternalLink, Copy } from 'lucide-react';

interface UploadAreaProps {
  activeItem: Item | null;
  onCopyStart: (files: string[], targetPath: string, action?: 'copy' | 'move') => void;
  progress: { currentFile: string; currentIndex: number; total: number; percentage: number } | null;
  copyResult: { success: boolean; successCount: number; failCount: number } | null;
}

/**
 * 登録された相対パスの配列から、指定したパス配下の直接の子フォルダ名を返すヘルパー。
 * @param folderPaths 登録済み相対パスの配列
 * @param currentRelativePath 現在選択中の相対パス（空文字列=ルート）
 */
function getDirectChildren(folderPaths: string[], currentRelativePath: string): string[] {
  const prefix = currentRelativePath ? currentRelativePath + '\\' : '';
  const children = new Set<string>();

  for (const p of folderPaths) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (!rest) continue;
    // 残りパスの最初のセグメントだけを取り出す
    const firstSegment = rest.split('\\')[0];
    children.add(firstSegment);
  }

  return Array.from(children).sort();
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  activeItem,
  onCopyStart,
  progress,
  copyResult,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  // 現在選択中の相対パス（空文字列=親フォルダ直下）
  const [selectedRelPath, setSelectedRelPath] = useState('');

  // コピー先のフルパスを解決する
  const getTargetPath = () => {
    if (!activeItem) return '';
    if (!selectedRelPath) return activeItem.parentPath;
    return `${activeItem.parentPath}\\${selectedRelPath}`;
  };

  const targetPath = getTargetPath();

  // アイテムが切り替わったら選択をリセット
  const activeItemId = activeItem?.id;
  React.useEffect(() => {
    setSelectedRelPath('');
  }, [activeItemId]);

  // 貼り付け (Ctrl+V) イベントの監視
  React.useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!activeItem || progress !== null) return;

      // 入力フォーム（モーダルの入力欄など）にフォーカスがある場合はペースト処理を実行しない
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (!e.clipboardData) return;
      const files = e.clipboardData.files;
      if (files.length === 0) return;

      // クリップボード内のファイルパスを取得
      const filePaths = Array.from(files)
        .map((file: any) => {
          if (window.electronAPI && window.electronAPI.getPathForFile) {
            return window.electronAPI.getPathForFile(file);
          }
          return file.path;
        })
        .filter((p) => !!p);

      if (filePaths.length > 0 && targetPath) {
        // コピーか移動（切り取り）かを判定する
        const action = window.electronAPI
          ? await window.electronAPI.getClipboardAction()
          : 'copy';
        onCopyStart(filePaths, targetPath, action);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [activeItem, progress, targetPath, onCopyStart]);

  // フォルダをエクスプローラーで開くハンドラー
  const handleOpenFolder = async () => {
    if (!targetPath) return;
    if (!window.electronAPI) {
      alert('ブラウザ環境のためフォルダを開けません。Electronで実行してください。');
      return;
    }
    const res = await window.electronAPI.openFolder(targetPath);
    if (res && !res.success) {
      alert(`フォルダを開けませんでした: ${res.error}`);
    }
  };

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('パスをコピーしました');
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      console.error('コピーエラー:', error);
      setCopyStatus('パスのコピーに失敗しました');
      window.setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const handleCopyTargetPath = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!targetPath) return;
    await copyTextToClipboard(targetPath);
  };

  // 現在の選択パスの直接の子フォルダボタンリスト
  const children = activeItem ? getDirectChildren(activeItem.folderPaths, selectedRelPath) : [];

  // パンくずリストを生成する
  const getBreadcrumbs = (): { label: string; path: string }[] => {
    if (!activeItem) return [];
    const crumbs: { label: string; path: string }[] = [
      { label: '親フォルダ', path: '' },
    ];
    if (!selectedRelPath) return crumbs;
    const parts = selectedRelPath.split('\\');
    let cumPath = '';
    for (const part of parts) {
      cumPath = cumPath ? cumPath + '\\' + part : part;
      crumbs.push({ label: part, path: cumPath });
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  // ドラッグハンドラー
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!activeItem || progress !== null) return;

    const fileList = e.dataTransfer.files;
    if (fileList.length === 0) return;

    // Electron特有の path プロパティから絶対パスを取得 (Electron 32以降はwebUtils経由で取得)
    const filePaths = Array.from(fileList).map((file: any) => {
      if (window.electronAPI && window.electronAPI.getPathForFile) {
        return window.electronAPI.getPathForFile(file);
      }
      return file.path;
    });

    if (filePaths.length > 0 && targetPath) {
      onCopyStart(filePaths, targetPath);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
      {/* フォルダ階層ボタン選択エリア */}
      {activeItem && (
        <div
          style={{
            background: 'rgba(19, 23, 45, 0.5)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '16px',
          }}
        >
          {/* パンくずリスト */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexWrap: 'wrap',
              marginBottom: children.length > 0 ? '12px' : '0',
            }}
          >
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                <button
                  onClick={() => setSelectedRelPath(crumb.path)}
                  style={{
                    background: idx === breadcrumbs.length - 1
                      ? 'rgba(124, 77, 255, 0.15)'
                      : 'transparent',
                    border: '1px solid',
                    borderColor: idx === breadcrumbs.length - 1
                      ? 'rgba(124, 77, 255, 0.4)'
                      : 'transparent',
                    color: idx === breadcrumbs.length - 1
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                  }}
                >
                  {idx === 0 && <Home size={11} />}
                  {crumb.label}
                </button>
                {idx < breadcrumbs.length - 1 && (
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* 子フォルダのボタングリッド */}
          {children.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              {children.map((child) => {
                const childRelPath = selectedRelPath ? selectedRelPath + '\\' + child : child;
                const grandChildren = getDirectChildren(activeItem.folderPaths, childRelPath);
                return (
                  <button
                    key={child}
                    onClick={() => setSelectedRelPath(childRelPath)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(124, 77, 255, 0.12)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 77, 255, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.04)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)';
                    }}
                  >
                    <FolderOpen size={14} style={{ color: 'var(--accent-secondary)' }} />
                    {child}
                    {grandChildren.length > 0 && (
                      <ChevronRight size={12} style={{ color: 'var(--text-muted)', marginLeft: '2px' }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {children.length === 0 && selectedRelPath && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              この階層にはさらに深いフォルダは登録されていません。
            </div>
          )}
        </div>
      )}

      {/* ドラッグ＆ドロップエリア */}
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          cursor: activeItem && progress === null ? 'pointer' : 'not-allowed',
          opacity: activeItem ? 1 : 0.6,
          flex: 1,
        }}
      >
        {!activeItem ? (
          <>
            <UploadCloud size={48} style={{ color: 'var(--text-muted)' }} />
            <div className="dropzone-text" style={{ color: 'var(--text-muted)' }}>
              左のサイドバーから項目を選択してください
            </div>
          </>
        ) : progress ? (
          // コピー中の表示
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Loader2 className="dropzone-icon animate-spin" size={40} style={{ color: 'var(--accent-secondary)' }} />
            <div className="dropzone-text">ファイルをコピー中...</div>

            <div className="progress-container">
              <div className="progress-header">
                <span>{progress.currentIndex} / {progress.total} 件目</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="progress-file-name">
                コピー中: {progress.currentFile}
              </div>
            </div>
          </div>
        ) : (
          // 通常（待機）表示
          <>
            <UploadCloud className="dropzone-icon" size={48} />
            <div className="dropzone-text">
              ここにファイル・フォルダをドラッグ＆ドロップ
            </div>
            <div className="dropzone-subtext">
              エクスプローラーからドロップします
            </div>

            {targetPath && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                <div className="destination-badge" title={targetPath} style={{ margin: 0 }}>
                  <FolderOpen size={12} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline-block' }} />
                  アップロード先: {targetPath}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyTargetPath(e);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(124, 77, 255, 0.12)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 77, 255, 0.4)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                    title="現在のパスをクリップボードにコピー"
                  >
                    <Copy size={12} />
                    <span>パスコピー</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFolder();
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(124, 77, 255, 0.12)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124, 77, 255, 0.4)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-glass)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                    title="エクスプローラーでこのフォルダを開く"
                  >
                    <ExternalLink size={12} />
                    <span>エクスプローラーで開く</span>
                  </button>
                </div>
              </div>
            )}
            {copyStatus && (
              <div style={{ fontSize: '12px', color: 'var(--accent-secondary)', marginTop: '10px' }}>
                {copyStatus}
              </div>
            )}
          </>
        )}

        {/* コピー結果通知 */}
        {copyResult && !progress && (
          <div className={`completion-state ${copyResult.failCount > 0 ? 'has-failed' : ''} animate-fade-in`}>
            {copyResult.failCount > 0 ? (
              <>
                <AlertCircle size={20} style={{ color: 'var(--error)' }} />
                <div style={{ fontSize: '13px' }}>
                  一部のファイルがコピーされませんでした。
                  <span style={{ fontWeight: 600, marginLeft: '8px' }}>
                    成功: {copyResult.successCount}件 / スキップ・失敗: {copyResult.failCount}件
                  </span>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                <div style={{ fontSize: '13px' }}>
                  ファイルのコピーが正常に完了しました。
                  <span style={{ fontWeight: 600, marginLeft: '8px' }}>
                    成功: {copyResult.successCount}件
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
