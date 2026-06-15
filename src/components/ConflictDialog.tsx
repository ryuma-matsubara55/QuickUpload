// src/components/ConflictDialog.tsx
// 同名ファイルまたはフォルダが存在する場合の競合解決ダイアログコンポーネント。

import React, { useState } from 'react';
import { AlertTriangle, File, Folder } from 'lucide-react';

interface ConflictDialogProps {
  isOpen: boolean;
  filename: string;
  isDirectory: boolean;
  onResolve: (action: 'overwrite' | 'skip' | 'rename', applyToAll: boolean) => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  filename,
  isDirectory,
  onResolve,
}) => {
  const [applyToAll, setApplyToAll] = useState(false);

  if (!isOpen) return null;

  // 別名コピーのプレビュー名を計算
  const getRenamePreview = () => {
    if (isDirectory) {
      return `${filename}_重複のためコピー`;
    }
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex === -1) {
      return `${filename}_重複のためコピー`;
    }
    const base = filename.substring(0, dotIndex);
    const ext = filename.substring(dotIndex);
    return `${base}_重複のためコピー${ext}`;
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content conflict-modal-content animate-fade-in">
        <div className="modal-header" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
            <AlertTriangle size={20} />
            同名ファイルの競合
          </div>
        </div>

        <div className="modal-body">
          <p className="conflict-desc">
            コピー先に同名の{isDirectory ? 'フォルダ' : 'ファイル'}が既に存在します。処理方法を選択してください。
          </p>

          <div className="conflict-file-box">
            {isDirectory ? (
              <Folder size={24} style={{ color: 'var(--accent-secondary)' }} />
            ) : (
              <File size={24} style={{ color: 'var(--text-secondary)' }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, wordBreak: 'break-all', fontSize: '13px' }}>{filename}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                別名コピー先: {getRenamePreview()}
              </div>
            </div>
          </div>

          <div className="conflict-options">
            {/* 別名でコピー（推奨） */}
            <button
              className="conflict-option-btn recommended"
              onClick={() => onResolve('rename', applyToAll)}
            >
              <span>別名でコピーして両方残す</span>
              <span className="recommended-badge">推奨</span>
            </button>

            {/* 上書き */}
            <button
              className="conflict-option-btn"
              onClick={() => onResolve('overwrite', applyToAll)}
            >
              上書きコピーする
            </button>

            {/* スキップ */}
            <button
              className="conflict-option-btn"
              onClick={() => onResolve('skip', applyToAll)}
            >
              このファイルをスキップする
            </button>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <span>残りのすべての競合に同じルールを適用する</span>
          </label>
        </div>
      </div>
    </div>
  );
};
