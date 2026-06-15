// src/electron.d.ts
// window.electronAPIの型定義を拡張し、TypeScriptのコンパイルエラーを防ぎます。

interface Window {
  electronAPI: {
    getPathForFile: (file: File) => string;
    openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
    loadConfig: () => Promise<{ items: any[]; history: any[] }>;
    saveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
    selectFolder: () => Promise<string | null>;
    scanFolders: (parentPath: string) => Promise<string[]>;
    checkPathExists: (folderPath: string) => Promise<boolean>;
    getClipboardAction: () => Promise<'copy' | 'move'>;
    copyFiles: (
      files: string[],
      targetPath: string,
      action?: 'copy' | 'move'
    ) => Promise<{ success: boolean; successCount: number; failCount: number; error?: string }>;
    onCopyProgress: (
      callback: (
        event: any,
        data: { currentFile: string; currentIndex: number; total: number; percentage: number }
      ) => void
    ) => () => void;
    onCopyConflict: (
      callback: (event: any, data: { filename: string; isDirectory: boolean }) => void
    ) => () => void;
    resolveConflict: (resolution: {
      action: 'overwrite' | 'skip' | 'rename';
      applyToAll: boolean;
    }) => Promise<boolean>;
    setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
    closeApp: () => Promise<void>;
    getAppVersion: () => Promise<string>;
    checkForUpdate: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    onUpdateStatus: (
      callback: (
        event: any,
        data: {
          status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev-mode';
          version?: string;
          releaseNotes?: string;
          percent?: number;
          transferred?: number;
          total?: number;
        }
      ) => void
    ) => () => void;
  };
}

