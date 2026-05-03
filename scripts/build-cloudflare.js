import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

// 只构建豆腐工厂原型
const entryKey = 'prototypes/tofu-factory-ops';
const distDir = path.resolve(workspaceRoot, 'dist');

// 清理 dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

// 构建
console.log(`构建: ${entryKey}`);
const result = spawnSync('npx', ['vite', 'build'], {
  cwd: workspaceRoot,
  env: { ...process.env, ENTRY_KEY: entryKey },
  stdio: 'inherit',
  shell: true
});

if (result.status !== 0) {
  console.error('构建失败');
  process.exit(1);
}

// 生成 HTML
console.log('生成 HTML...');
const htmlResult = spawnSync('node', ['scripts/generate-dist-html.js'], {
  cwd: workspaceRoot,
  stdio: 'inherit',
  shell: true
});

if (htmlResult.status !== 0) {
  console.error('HTML 生成失败');
  process.exit(1);
}

// 创建根目录 index.html 重定向
const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/prototypes/tofu-factory-ops.html">
  <title>豆腐工厂</title>
</head>
<body>
  <p>正在跳转... <a href="/prototypes/tofu-factory-ops.html">点击这里</a></p>
</body>
</html>`;

fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
console.log('Cloudflare 构建完成 ✅');
