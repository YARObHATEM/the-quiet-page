const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

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

console.log(`Syntax checked ${files.length} JavaScript files.`);
