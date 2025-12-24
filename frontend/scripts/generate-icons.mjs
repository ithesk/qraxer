import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Read SVG
const svgBuffer = readFileSync(join(publicDir, 'favicon.svg'));

// Icon sizes to generate
const icons = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'maskable-192x192.png', size: 192, maskable: true },
  { name: 'maskable-512x512.png', size: 512, maskable: true },
];

async function generateIcons() {
  console.log('Generating PWA icons...\n');

  for (const icon of icons) {
    const outputPath = join(publicDir, icon.name);

    if (icon.maskable) {
      // For maskable icons, add padding (safe zone is 80% of icon)
      const padding = Math.round(icon.size * 0.1);
      const innerSize = icon.size - (padding * 2);

      await sharp(svgBuffer)
        .resize(innerSize, innerSize)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 37, g: 99, b: 235, alpha: 1 } // Primary blue
        })
        .png()
        .toFile(outputPath);
    } else {
      await sharp(svgBuffer)
        .resize(icon.size, icon.size)
        .png()
        .toFile(outputPath);
    }

    console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
  }

  // Generate favicon.ico (multi-size)
  console.log('\n✓ All icons generated successfully!');
}

generateIcons().catch(console.error);
