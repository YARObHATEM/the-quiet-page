const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const {
  extractTitleAndBody,
  truncateTitle,
} = require('../src/renderer/js/utils');

function findJavaScriptFiles(directory) {
  const files = [];

  for (const name of readdirSync(directory)) {
    const fullPath = join(directory, name);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findJavaScriptFiles(fullPath));
    } else if (name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = findJavaScriptFiles(join(__dirname, '..', 'src'));

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

assert.deepEqual(extractTitleAndBody(null), { title: '', body: '' });
assert.deepEqual(extractTitleAndBody('   \n  '), { title: '', body: '' });
assert.deepEqual(extractTitleAndBody('Only a title'), { title: 'Only a title', body: '' });
assert.deepEqual(
  extractTitleAndBody('\n\n  Window Evening  \n\nThe room was quiet.\nSecond line.'),
  { title: 'Window Evening', body: 'The room was quiet.\nSecond line.' }
);
assert.deepEqual(
  extractTitleAndBody('مساء النافذة\n\nكان المساء هادئاً'),
  { title: 'مساء النافذة', body: 'كان المساء هادئاً' }
);
assert.equal(truncateTitle('a'.repeat(121), 120), 'a'.repeat(120) + '…');

const requiredFonts = [
  'lora-latin-400-normal.woff2',
  'lora-latin-700-normal.woff2',
  'merriweather-latin-400-normal.woff2',
  'merriweather-latin-700-normal.woff2',
  'jetbrains-mono-latin-400-normal.woff2',
  'jetbrains-mono-latin-700-normal.woff2',
  'nunito-latin-400-normal.woff2',
  'nunito-latin-700-normal.woff2',
  'playfair-display-latin-400-normal.woff2',
  'playfair-display-latin-700-normal.woff2',
  'tajawal-arabic-400-normal.woff2',
  'tajawal-arabic-700-normal.woff2',
  'lateef-arabic-400-normal.woff2',
  'lateef-arabic-700-normal.woff2',
  'cairo-arabic-400-normal.woff2',
  'cairo-arabic-700-normal.woff2',
  'scheherazade-new-arabic-400-normal.woff2',
  'scheherazade-new-arabic-700-normal.woff2',
];

for (const fontFile of requiredFonts) {
  const font = readFileSync(join(__dirname, '..', 'src', 'renderer', 'fonts', fontFile));
  assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2', `${fontFile} is not valid WOFF2`);
}

const requiredAmbientAudio = [
  'forest-clean.ogg',
  'cafe.ogg',
  'lofi.ogg',
  'fireplace.ogg',
  'ocean.ogg',
  'thunder.ogg',
  'birds.ogg',
  'river.ogg',
  'wind.ogg',
  'train.ogg',
  'night.ogg',
];
for (const audioFile of requiredAmbientAudio) {
  const audio = readFileSync(join(__dirname, '..', 'src', 'renderer', 'audio', 'ambient', audioFile));
  assert.equal(audio.subarray(0, 4).toString('ascii'), 'OggS', `${audioFile} is not valid Ogg audio`);
}

console.log(`Syntax checked ${files.length} JavaScript files.`);
console.log('Title system utility checks passed.');
console.log(`Verified ${requiredFonts.length} extended local font files.`);
console.log(`Verified ${requiredAmbientAudio.length} local ambient audio files.`);
