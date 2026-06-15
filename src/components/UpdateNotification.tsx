// src/components/UpdateNotification.tsx
// 自動アップデートの通知と操作を行うコンポーネント

import React from 'react';
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode';
  version?: string;
  releaseNotes?: string;
  percent?: number;
}

interface UpdateNotificationProps {
  updateState: UpdateState;
  onClose: () => void;
  onDownload: () => void;
  onInstall: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  updateState,
  onClose,
  onDownload,
  onInstall,
}) => {
  const { status, version, percent } = updateState;

  if (status === 'idle') return null;

  // 各種ステータスに合わせた表示内容の決定
  let title = '';
  let message = '';
  let icon = <Download size={20} className="text-accent" />;
  let actionButton: React.ReactNode = null;

  switch (status) {
    case 'checking':
      title = 'アップデートを確認中';
      message = '最新バージョンを確認しています...';
      icon = <RefreshCw size={20} className="animate-spin text-accent" />;
      break;
    case 'available':
      title = '新しいアップデートがあります';
      message = `バージョン v${version} が利用可能です。ダウンロードしますか？`;
      actionButton = (
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={onDownload}>
          ダウンロード
        </button>
      );
      break;
    case 'not-available':
      title = '最新の状態です';
      message = 'お使いのアプリケーションは最新バージョンです。';
      break;
    case 'downloading':
      title = 'アップデートをダウンロード中';
      message = `新しいバージョンをダウンロードしています... (${percent || 0}%)`;
      actionButton = (
        <div style={{ width: '100px', background: 'var(--bg-tertiary)', borderRadius: '4px', height: '8px', overflow: 'hidden', marginTop: '6px' }}>
          <div style={{ width: `${percent || 0}%`, background: 'var(--accent-gradient)', height: '100%', transition: 'width 0.1s ease' }} />
        </div>
      );
      break;
    case 'downloaded':
      title = 'ダウンロード完了';
      message = `バージョン v${version} の準備ができました。適用して再起動しますか？`;
      icon = <RefreshCw size={20} className="text-success" style={{ color: 'var(--success)' }} />;
      actionButton = (
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={onInstall}>
          今すぐ再起動
        </button>
      );
      break;
    case 'dev-mode':
      title = '開発モード';
      message = '開発環境のため、自動アップデート機能はスキップされました。';
      break;
    case 'error':
      title = 'アップデートエラー';
      message = 'アップデートの確認中にエラーが発生しました（オフライン等の可能性があります）。';
      icon = <AlertCircle size={20} style={{ color: 'var(--error)' }} />;
      break;
    default:
      return null;
  }

  return (
    <div 
      className="glass-card animate-fade-in" 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '320px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--accent-primary)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</span>
        </div>
        {status !== 'checking' && status !== 'downloading' && (
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{message}</p>

      {actionButton && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          {actionButton}
        </div>
      )}
    </div>
  );
};
