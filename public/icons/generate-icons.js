// Run: node generate-icons.js
// Generates SVG-based icons for the PWA (no image dependencies)

const fs = require('fs');
const path = require('path');

function makeSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#0f0f0f"/>
  <rect x="${size*0.08}" y="${size*0.08}" width="${size*0.84}" height="${size*0.84}" rx="${size*0.16}" fill="#1a1a1a"/>
  <!-- Mic body -->
  <rect x="${size*0.42}" y="${size*0.15}" width="${size*0.16}" height="${size*0.32}" rx="${size*0.08}" fill="#f97316"/>
  <!-- Mic arc -->
  <path d="M ${size*0.28} ${size*0.42} Q ${size*0.28} ${size*0.65} ${size*0.5} ${size*0.65} Q ${size*0.72} ${size*0.65} ${size*0.72} ${size*0.42}" stroke="#f97316" stroke-width="${size*0.04}" fill="none" stroke-linecap="round"/>
  <!-- Mic stand -->
  <line x1="${size*0.5}" y1="${size*0.65}" x2="${size*0.5}" y2="${size*0.78}" stroke="#f97316" stroke-width="${size*0.04}" stroke-linecap="round"/>
  <line x1="${size*0.35}" y1="${size*0.78}" x2="${size*0.65}" y2="${size*0.78}" stroke="#f97316" stroke-width="${size*0.04}" stroke-linecap="round"/>
  <!-- Waveform bars -->
  <rect x="${size*0.18}" y="${size*0.40}" width="${size*0.04}" height="${size*0.12}" rx="${size*0.02}" fill="#f97316" opacity="0.5"/>
  <rect x="${size*0.18}" y="${size*0.36}" width="${size*0.04}" height="${size*0.20}" rx="${size*0.02}" fill="#f97316" opacity="0.7"/>
  <rect x="${size*0.74}" y="${size*0.40}" width="${size*0.04}" height="${size*0.12}" rx="${size*0.02}" fill="#f97316" opacity="0.5"/>
  <rect x="${size*0.74}" y="${size*0.36}" width="${size*0.04}" height="${size*0.20}" rx="${size*0.02}" fill="#f97316" opacity="0.7"/>
</svg>`;
}

const sizes = [192, 512];
sizes.forEach(size => {
  fs.writeFileSync(path.join(__dirname, `icon-${size}.svg`), makeSVG(size));
  console.log(`Created icon-${size}.svg`);
});

console.log('\nNote: For production, convert SVGs to PNG with:');
console.log('  npm install -g sharp-cli');
console.log('  sharp -i icon-192.svg -o icon-192.png');
