// scripts/build-electron.cjs
// ElectronのメインプロセスとプリロードスクリプトをCommonJSとしてビルドするためのスクリプト。

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ビルド出力先フォルダのパス
const outDir = path.join(__dirname, '../dist-electron');

// 出力先フォルダが存在しない場合は作成する
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

try {
  console.log('ElectronのTypeScriptファイルをコンパイル中...');
  // tscを用いてelectronフォルダ内のファイルを共通JSモジュール (CommonJS) としてコンパイルします。
  execSync(
    'npx tsc -p electron/tsconfig.json',
    { stdio: 'inherit' }
  );

  console.log('dist-electron/package.json を出力中...');
  // 親の package.json (type: "module") の影響を避けるために type: "commonjs" を書き出します。
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    JSON.stringify({ type: 'commonjs' }, null, 2)
  );

  console.log('Electronのビルドが完了しました。');
} catch (error) {
  console.error('Electronのビルド中にエラーが発生しました:', error);
  process.exit(1);
}
