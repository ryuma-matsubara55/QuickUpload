// src/components/SettingModal.tsx
// 項目（案件・フォルダ分類）の登録、および無制限階層のフォルダ設定を行うモーダルコンポーネント。

import React, { useState, useEffect } from 'react';
import type { Item } from '../types';
import { X, Plus, Trash2, FolderOpen, RefreshCw, Check, AlertTriangle, ChevronRight, Home } from 'lucide-react';

interface SettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  onSaveItems: (updatedItems: Item[]) => void;
}

/**
 * folderPathsから指定パス直下の子フォルダ名を返すヘルパー
 */
function getDirectChildren(folderPaths: string[], parentRelPath: string): string[] {
  const prefix = parentRelPath ? parentRelPath + '\\' : '';
  const children = new Set<string>();
  for (const p of folderPaths) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (!rest) continue;
    const firstSegment = rest.split('\\')[0];
    children.add(firstSegment);
  }
  return Array.from(children).sort();
}

export const SettingModal: React.FC<SettingModalProps> = ({
  isOpen,
  onClose,
  items,
  onSaveItems,
}) => {
  const [localItems, setLocalItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // スキャンダイアログ用ステート
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanParentRelPath, setScanParentRelPath] = useState('');
  const [scanResults, setScanResults] = useState<string[]>([]);
  const [selectedScanItems, setSelectedScanItems] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  // フォルダツリー操作用：現在の選択パス（追加操作の親となる）
  const [expandedPath, setExpandedPath] = useState('');

  // エラーメッセージ
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setLocalItems(JSON.parse(JSON.stringify(items)));
      setSelectedItemId(items.length > 0 ? items[0].id : '');
      setExpandedPath('');
      setErrorMsg('');
      setScanDialogOpen(false);
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const currentItem = localItems.find((item) => item.id === selectedItemId);

  // 項目の更新
  const updateCurrentItem = (fields: Partial<Item>) => {
    if (!currentItem) return;
    const updated = { ...currentItem, ...fields, updatedAt: new Date().toISOString() };
    setLocalItems(localItems.map((item) => (item.id === selectedItemId ? updated : item)));
  };

  // 新規項目を追加
  const handleAddItem = () => {
    const newItem: Item = {
      id: Math.random().toString(36).substring(2, 9),
      name: '新規項目',
      parentPath: '',
      folderPaths: [],
      order: localItems.length + 1,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newItems = [...localItems, newItem];
    setLocalItems(newItems);
    setSelectedItemId(newItem.id);
    setExpandedPath('');
    setErrorMsg('');
  };

  // 項目を削除
  const handleDeleteItem = (id: string) => {
    const newItems = localItems.filter((item) => item.id !== id);
    setLocalItems(newItems);
    setSelectedItemId(newItems.length > 0 ? newItems[0].id : '');
    setExpandedPath('');
  };

  // 親フォルダをダイアログで選択
  const handleSelectParentPath = async () => {
    if (!currentItem) return;
    if (!window.electronAPI) {
      updateCurrentItem({ parentPath: 'C:\\Desktop\\Project_Demo', folderPaths: [] });
      setErrorMsg('');
      return;
    }
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      // 親フォルダ変更時は登録済みフォルダも全クリア
      updateCurrentItem({ parentPath: folderPath, folderPaths: [] });
      setExpandedPath('');
      setErrorMsg('');
    }
  };

  // フォルダを手動追加（expandedPathの子として追加）
  const handleAddFolderManual = async () => {
    if (!currentItem || !currentItem.parentPath) {
      setErrorMsg('先に親フォルダを設定してください。');
      return;
    }

    const parentExists = window.electronAPI
      ? await window.electronAPI.checkPathExists(currentItem.parentPath)
      : true;
    if (!parentExists) {
      setErrorMsg('親フォルダが存在しません。正しいパスを設定してください。');
      return;
    }

    let selectedName = '';
    if (window.electronAPI) {
      // ダイアログで選択した後、相対パスに変換
      const absParentInDialog = expandedPath
        ? `${currentItem.parentPath}\\${expandedPath}`
        : currentItem.parentPath;

      const selected = await window.electronAPI.selectFolder();
      if (!selected) return;

      const normalizedParent = absParentInDialog.toLowerCase().replace(/\//g, '\\');
      const normalizedSelected = selected.toLowerCase().replace(/\//g, '\\');

      if (!normalizedSelected.startsWith(normalizedParent + '\\')) {
        setErrorMsg(`選択したフォルダは「${absParentInDialog}」の直下にある必要があります。`);
        return;
      }
      const relFromParent = selected.slice(absParentInDialog.length + 1);
      if (relFromParent.includes('\\')) {
        setErrorMsg('直接の子フォルダのみ選択できます。より深い階層はそのフォルダを展開してから追加してください。');
        return;
      }
      selectedName = relFromParent;
    } else {
      // Webデモ用
      const name = prompt(`「${expandedPath || '親フォルダ'}」直下の追加するフォルダ名:`, '新規フォルダ');
      if (!name) return;
      selectedName = name;
    }

    const newRelPath = expandedPath ? `${expandedPath}\\${selectedName}` : selectedName;

    if (currentItem.folderPaths.includes(newRelPath)) {
      setErrorMsg('このフォルダは既に登録されています。');
      return;
    }

    updateCurrentItem({ folderPaths: [...currentItem.folderPaths, newRelPath] });
    setErrorMsg('');
  };

  // 自動スキャン開始
  const handleStartScan = async () => {
    if (!currentItem || !currentItem.parentPath) {
      setErrorMsg('先に親フォルダを設定してください。');
      return;
    }
    setErrorMsg('');

    const scanAbsPath = expandedPath
      ? `${currentItem.parentPath}\\${expandedPath}`
      : currentItem.parentPath;

    const exists = window.electronAPI
      ? await window.electronAPI.checkPathExists(scanAbsPath)
      : true;
    if (!exists) {
      setErrorMsg(`「${scanAbsPath}」は存在しません。`);
      return;
    }

    setScanParentRelPath(expandedPath);
    setScanDialogOpen(true);
    setScanning(true);
    setScanResults([]);
    setSelectedScanItems([]);

    try {
      let results: string[] = [];
      if (window.electronAPI) {
        results = await window.electronAPI.scanFolders(scanAbsPath);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        results = ['図面フォルダ', '現場写真', '検査データ', '請求書', '報告書', 'アーカイブ'];
      }
      // すでに同じレベルで登録済みのものを除外
      const prefix = expandedPath ? expandedPath + '\\' : '';
      const registered = new Set(
        currentItem.folderPaths
          .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('\\'))
          .map((p) => p.slice(prefix.length))
      );
      setScanResults(results.filter((r) => !registered.has(r)));
    } catch {
      setErrorMsg('スキャン中にエラーが発生しました。');
      setScanDialogOpen(false);
    } finally {
      setScanning(false);
    }
  };

  // スキャン結果の選択トグル
  const handleToggleScanItem = (name: string) => {
    if (selectedScanItems.includes(name)) {
      setSelectedScanItems(selectedScanItems.filter((i) => i !== name));
    } else {
      setSelectedScanItems([...selectedScanItems, name]);
    }
  };

  // スキャン結果を登録
  const handleRegisterScanned = () => {
    if (!currentItem) return;
    const prefix = scanParentRelPath ? scanParentRelPath + '\\' : '';
    const newPaths = selectedScanItems
      .map((name) => prefix + name)
      .filter((p) => !currentItem.folderPaths.includes(p));
    updateCurrentItem({ folderPaths: [...currentItem.folderPaths, ...newPaths] });
    setScanDialogOpen(false);
  };

  // フォルダを削除（子孫も含めて削除）
  const handleDeleteFolder = (relPath: string) => {
    if (!currentItem) return;
    const prefix = relPath + '\\';
    const newPaths = currentItem.folderPaths.filter(
      (p) => p !== relPath && !p.startsWith(prefix)
    );
    updateCurrentItem({ folderPaths: newPaths });
    // 削除したパスが現在展開中なら上の階層に戻る
    if (expandedPath === relPath || expandedPath.startsWith(relPath + '\\')) {
      const parent = relPath.includes('\\') ? relPath.substring(0, relPath.lastIndexOf('\\')) : '';
      setExpandedPath(parent);
    }
  };

  // パンくずリスト
  const getBreadcrumbs = () => {
    const crumbs: { label: string; path: string }[] = [{ label: '親フォルダ直下', path: '' }];
    if (!expandedPath) return crumbs;
    const parts = expandedPath.split('\\');
    let cum = '';
    for (const p of parts) {
      cum = cum ? cum + '\\' + p : p;
      crumbs.push({ label: p, path: cum });
    }
    return crumbs;
  };

  // 保存
  const handleSave = async () => {
    setErrorMsg('');
    for (const item of localItems) {
      if (!item.name.trim()) {
        setErrorMsg('項目名を入力してください。');
        return;
      }
      if (item.enabled) {
        if (!item.parentPath) {
          setErrorMsg(`項目「${item.name}」の親フォルダパスが指定されていません。`);
          return;
        }
        const exists = window.electronAPI
          ? await window.electronAPI.checkPathExists(item.parentPath)
          : true;
        if (!exists) {
          setErrorMsg(`項目「${item.name}」の親フォルダが存在しません。`);
          return;
        }
      }
    }
    onSaveItems(localItems);
    onClose();
  };

  const breadcrumbs = getBreadcrumbs();
  const directChildren = currentItem
    ? getDirectChildren(currentItem.folderPaths, expandedPath)
    : [];

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content animate-fade-in" style={{ position: 'relative' }}>

        {/* スキャンダイアログ（インナー） */}
        {scanDialogOpen && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(11, 13, 25, 0.97)',
              zIndex: 10, display: 'flex', flexDirection: 'column', padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                フォルダ自動検出 — 「{scanParentRelPath || '親フォルダ直下'}」
              </h3>
              <button className="icon-btn" onClick={() => setScanDialogOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {scanning ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)', marginBottom: '10px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>スキャン中...</span>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scanResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                      新規検出されたフォルダはありません。
                    </div>
                  ) : (
                    scanResults.map((name) => {
                      const isSelected = selectedScanItems.includes(name);
                      return (
                        <div
                          key={name}
                          className="scan-item"
                          onClick={() => handleToggleScanItem(name)}
                          style={{
                            borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-glass)',
                            background: isSelected ? 'rgba(124, 77, 255, 0.08)' : '',
                          }}
                        >
                          <input type="checkbox" checked={isSelected} onChange={() => {}} className="checkbox-input" />
                          <span>{name}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                  <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setScanDialogOpen(false)}>
                    キャンセル
                  </button>
                  <button
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                    disabled={selectedScanItems.length === 0}
                    onClick={handleRegisterScanned}
                  >
                    選択したフォルダを登録 ({selectedScanItems.length}件)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ヘッダー */}
        <div className="modal-header">
          <div className="modal-title">項目・フォルダ設定</div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ minHeight: '440px' }}>
          {/* エラーメッセージ */}
          {errorMsg && (
            <div style={{ background: 'var(--error-glow)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--error)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="settings-split">
            {/* 左: 項目リスト */}
            <div className="settings-list">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>登録項目</span>
                <button className="icon-btn" onClick={handleAddItem} title="項目を追加" style={{ background: 'var(--bg-tertiary)', borderRadius: '50%', padding: '4px' }}>
                  <Plus size={14} />
                </button>
              </div>
              {localItems.map((item) => (
                <div
                  key={item.id}
                  className={`settings-list-item ${item.id === selectedItemId ? 'active' : ''}`}
                  onClick={() => { setSelectedItemId(item.id); setExpandedPath(''); setErrorMsg(''); }}
                  style={{ opacity: item.enabled ? 1 : 0.5 }}
                >
                  {item.name}
                </div>
              ))}
            </div>

            {/* 右: 項目編集フォーム */}
            <div className="settings-form">
              {currentItem ? (
                <>
                  {/* 項目名 */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label">項目名</label>
                      <button className="icon-btn danger" title="削除" onClick={() => handleDeleteItem(currentItem.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      value={currentItem.name}
                      onChange={(e) => updateCurrentItem({ name: e.target.value })}
                      placeholder="例: A案件, 見積フォルダ"
                    />
                  </div>

                  {/* 有効/無効 */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" className="checkbox-input" checked={currentItem.enabled} onChange={(e) => updateCurrentItem({ enabled: e.target.checked })} />
                      <span>この項目を有効にする（メイン画面のサイドバーに表示）</span>
                    </label>
                  </div>

                  {/* 親フォルダ */}
                  <div className="form-group">
                    <label className="form-label">親フォルダパス</label>
                    <div className="form-row">
                      <input
                        type="text"
                        className="form-input"
                        value={currentItem.parentPath}
                        onChange={(e) => updateCurrentItem({ parentPath: e.target.value })}
                        placeholder="C:\path\to\folder"
                      />
                      <button
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 12px', flexShrink: 0 }}
                        onClick={handleSelectParentPath}
                      >
                        <FolderOpen size={14} />
                        <span>参照</span>
                      </button>
                    </div>
                  </div>

                  {/* フォルダ階層設定 */}
                  <div className="folder-config-box">
                    {/* パンくず＋操作ボタン */}
                    <div className="folder-box-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {breadcrumbs.map((crumb, idx) => (
                          <React.Fragment key={crumb.path}>
                            <button
                              className="icon-btn"
                              style={{ fontSize: '11px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px', background: idx === breadcrumbs.length - 1 ? 'rgba(0,229,255,0.1)' : 'transparent', borderRadius: '4px', border: '1px solid', borderColor: idx === breadcrumbs.length - 1 ? 'rgba(0,229,255,0.3)' : 'transparent', color: idx === breadcrumbs.length - 1 ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}
                              onClick={() => setExpandedPath(crumb.path)}
                            >
                              {idx === 0 && <Home size={10} />}
                              {crumb.label}
                            </button>
                            {idx < breadcrumbs.length - 1 && <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />}
                          </React.Fragment>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={handleStartScan}
                          disabled={!currentItem.parentPath}
                        >
                          <RefreshCw size={10} />
                          <span>自動検索</span>
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={handleAddFolderManual}
                          disabled={!currentItem.parentPath}
                        >
                          <Plus size={10} />
                          <span>手動追加</span>
                        </button>
                      </div>
                    </div>

                    {/* フォルダツリー（現在の階層） */}
                    <div className="folder-list-container">
                      {directChildren.length === 0 ? (
                        <div style={{ padding: '16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          {currentItem.parentPath
                            ? `「${expandedPath || '親フォルダ直下'}」にはフォルダが未登録です。自動検索または手動追加で登録してください。`
                            : '先に親フォルダパスを設定してください。'
                          }
                        </div>
                      ) : (
                        directChildren.map((child) => {
                          const childRelPath = expandedPath ? `${expandedPath}\\${child}` : child;
                          const hasChildren = getDirectChildren(currentItem.folderPaths, childRelPath).length > 0;
                          return (
                            <div
                              key={child}
                              className="folder-list-item"
                              style={{ cursor: 'pointer', background: expandedPath === childRelPath ? 'rgba(0, 229, 255, 0.06)' : '' }}
                              onClick={() => setExpandedPath(childRelPath)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                <FolderOpen size={13} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px' }}>{child}</span>
                                {hasChildren && <ChevronRight size={11} style={{ color: 'var(--text-muted)' }} />}
                              </div>
                              <button
                                className="icon-btn danger"
                                title="このフォルダ（子孫含む）を削除"
                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(childRelPath); }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 登録済みフォルダパスの確認 */}
                  {currentItem.folderPaths.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      登録済みフォルダ数: {currentItem.folderPaths.length}件
                    </div>
                  )}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  左のリストから項目を選択するか、新規作成してください。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" style={{ padding: '10px 20px' }} onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleSave}>
            <Check size={16} />
            <span>設定を保存</span>
          </button>
        </div>
      </div>
    </div>
  );
};
