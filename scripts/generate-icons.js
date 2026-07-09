/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
/**
 * scripts/generate-icons.js
 *
 * Generates correctly-sized extension icons (16x16, 32x32, 48x48, 128x128)
 * as PNG files using the Node.js Canvas API.
 *
 * Usage:
 *   node scripts/generate-icons.js
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const SIZES = [16, 32, 48, 128];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');
const BANNER_PATH = path.join(__dirname, '..', 'banner.png');

// --- Try canvas-based generation first ---
async function generateWithCanvas() {
  const { createCanvas, loadImage } = require('canvas');
  
  if (!fs.existsSync(BANNER_PATH)) {
    console.error(`Error: Could not find ${BANNER_PATH}`);
    process.exit(1);
  }

  const image = await loadImage(BANNER_PATH);

  for (const size of SIZES) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Make the icon a rounded rectangle
    const radius = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(image, 0, 0, size, size);

    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(OUTPUT_DIR, `icon${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ Generated ${outPath} (${size}×${size})`);
  }
}

// --- Main ---
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

try {
  require.resolve('canvas');
  console.log('Using canvas package to generate icons...');
  generateWithCanvas().catch((err) => {
    console.error('Error generating icons:', err);
    process.exit(1);
  });
} catch {
  console.error('canvas package not found. Run: npm install');
  process.exit(1);
}

