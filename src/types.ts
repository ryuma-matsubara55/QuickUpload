// src/types.ts
// アプリケーション全体で使用するデータモデルの定義。

export interface Item {
  id: string;             // 項目ID
  name: string;           // 項目名 (分類名)
  parentPath: string;     // 親フォルダパス
  folderPaths: string[];  // 登録された相対フォルダパスの配列 (例: ["図面", "図面\\意匠", "現場写真"])
  order: number;          // 表示順
  enabled: boolean;       // 有効 / 無効
  createdAt: string;      // 作成日時 (ISO string)
  updatedAt: string;      // 更新日時 (ISO string)
}

export interface HistoryLog {
  id: string;             // 履歴ID
  itemName: string;       // コピー実行時の項目名
  targetPath: string;     // 実際にコピーした宛先フォルダのフルパス
  files: string[];        // コピーしたファイル・フォルダ名の配列
  successCount: number;   // 成功件数
  failCount: number;      // 失敗件数
  timestamp: string;      // 実行日時 (ISO string)
}
