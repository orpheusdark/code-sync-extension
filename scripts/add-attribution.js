import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const JS_TS_HEADER = `/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
`;

const HTML_HEADER = `<!--
CodeSync
Original Author: orpheusdark
-->
`;

const CSS_HEADER = `/*
CodeSync
Original Author: orpheusdark
*/
`;

function addHeader(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('Original Author: orpheusdark') || content.includes('orpheusdark')) {
    return;
  }
  
  let newContent = content;
  
  if (['.ts', '.js'].includes(ext)) {
    newContent = JS_TS_HEADER + content;
  } else if (ext === '.html') {
    newContent = HTML_HEADER + content;
  } else if (ext === '.css') {
    newContent = CSS_HEADER + content;
  }
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Added header to', filePath);
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (['node_modules', 'dist', '.git', 'public'].includes(file)) continue;
      processDirectory(fullPath);
    } else {
      if (['.ts', '.js', '.html', '.css'].includes(path.extname(fullPath))) {
        addHeader(fullPath);
      }
    }
  }
}

processDirectory(path.join(ROOT_DIR, 'src'));
processDirectory(path.join(ROOT_DIR, 'scripts'));
addHeader(path.join(ROOT_DIR, 'popup.html'));
addHeader(path.join(ROOT_DIR, 'options.html'));
addHeader(path.join(ROOT_DIR, 'vite.config.ts'));

console.log('Done!');
