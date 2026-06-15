// src/components/Sidebar.tsx
// 項目リストと設定ボタンを表示するサイドバーコンポーネント。

import React from 'react';
import type { Item } from '../types';
import { Settings, FolderKanban, ChevronRight } from 'lucide-react';

interface SidebarProps {
  items: Item[];
  activeItemId: string;
  onSelectActiveItem: (id: string) => void;
  onOpenSettings: () => void;
  appVersion: string;
  onCheckUpdate: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeItemId,
  onSelectActiveItem,
  onOpenSettings,
  appVersion,
  onCheckUpdate,
}) => {
  // 有効な項目のみをフィルタリングし、表示順(order)でソート
  const displayItems = items
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo-glow" />
        <span className="sidebar-title">QUICK UPLOAD</span>
      </div>

      <div className="sidebar-menu">
        {displayItems.length === 0 ? (
          <div style={{ padding: '20px 10px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
            項目が登録されていません。<br />右下の「設定」から作成してください。
          </div>
        ) : (
          displayItems.map((item) => (
            <div
              key={item.id}
              className={`menu-item ${item.id === activeItemId ? 'active' : ''}`}
              onClick={() => onSelectActiveItem(item.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <FolderKanban size={16} style={{ flexShrink: 0 }} />
                <span className="menu-item-text">{item.name}</span>
              </div>
              <ChevronRight size={14} style={{ opacity: item.id === activeItemId ? 0.8 : 0 }} />
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }} onClick={onOpenSettings}>
          <Settings size={16} />
          <span>項目・フォルダ設定</span>
        </button>
        <div 
          onClick={onCheckUpdate}
          style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)', 
            textAlign: 'center', 
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'background-color 0.2s, color 0.2s'
          }}
          className="version-display"
        >
          v{appVersion || '0.1.0'} (アップデート確認)
        </div>
      </div>
    </aside>
  );
};

