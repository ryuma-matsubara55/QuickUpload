// src/components/HistoryArea.tsx
// アップロード履歴を綺麗に一覧表示するコンポーネント。

import React from 'react';
import type { HistoryLog } from '../types';
import { Clock, Trash2, CheckCircle2, AlertTriangle, FileText, Copy } from 'lucide-react';

interface HistoryAreaProps {
  history: HistoryLog[];
  onClearHistory: () => void;
}

export const HistoryArea: React.FC<HistoryAreaProps> = ({ history, onClearHistory }) => {
  // 最新の履歴が上に来るように並び替える
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const [copyMessage, setCopyMessage] = React.useState<string | null>(null);

  // 日時フォーマット用のヘルパー
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('パスをコピーしました');
      window.setTimeout(() => setCopyMessage(null), 2000);
    } catch (error) {
      console.error('コピーエラー:', error);
      setCopyMessage('パスのコピーに失敗しました');
      window.setTimeout(() => setCopyMessage(null), 2000);
    }
  };

  const buildHistoryCopyText = (log: HistoryLog) => {
    if (!log.files || log.files.length === 0) {
      return log.targetPath;
    }
    if (log.files.length === 1) {
      return `${log.targetPath}\\${log.files[0]}`;
    }
    return log.files.map((name) => `${log.targetPath}\\${name}`).join('\n');
  };

  const handleCopyHistoryPath = async (log: HistoryLog) => {
    const text = buildHistoryCopyText(log);
    await copyTextToClipboard(text);
  };

  return (
    <section className="history-section">
      <div className="section-header">
        <div className="section-title">
          <Clock size={16} style={{ color: 'var(--accent-secondary)' }} />
          <span>アップロード履歴 (最近の履歴)</span>
        </div>
        {history.length > 0 && (
          <button
            className="icon-btn danger"
            onClick={onClearHistory}
            title="履歴をすべて消去"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px' }}
          >
            <Trash2 size={12} />
            <span>履歴消去</span>
          </button>
        )}
      </div>
      {copyMessage && (
        <div style={{ fontSize: '12px', color: 'var(--accent-secondary)', marginTop: '8px' }}>
          {copyMessage}
        </div>
      )}

      <div className="glass-card history-list">
        {sortedHistory.length === 0 ? (
          <div style={{ padding: '30px 10px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
            履歴はまだありません。
          </div>
        ) : (
          sortedHistory.map((log) => {
            const hasFailed = log.failCount > 0;
            const fileCount = log.files.length;
            const fileNamesPreview = log.files.join(', ');

            return (
              <div key={log.id} className="history-item">
                <div className="history-left">
                  <div className="history-file-title" title={fileNamesPreview}>
                    <FileText size={13} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline-block', color: 'var(--text-secondary)' }} />
                    {log.files[0]}
                    {fileCount > 1 && ` 外 ${fileCount - 1}件`}
                  </div>
                  <div className="history-meta">
                    <span>{formatTime(log.timestamp)}</span>
                    <span>•</span>
                    <span style={{ color: 'var(--accent-secondary)' }}>{log.itemName}</span>
                    <span>•</span>
                    <span title={log.targetPath}>宛先: ...{log.targetPath.split('\\').pop()}</span>
                  </div>
                </div>

                <div className="history-right">
                  <span className={`history-badge ${hasFailed ? 'fail' : 'success'}`}>
                    {hasFailed ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <AlertTriangle size={10} />
                        失敗有
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={10} />
                        成功
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <button
                      onClick={() => handleCopyHistoryPath(log)}
                      title="履歴のパスをコピー"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-secondary)',
                        padding: '6px 10px',
                        borderRadius: '18px',
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
                    >
                      <Copy size={12} />
                      <span>パスコピー</span>
                    </button>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      成:{log.successCount} / 避:{log.failCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
