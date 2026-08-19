import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../packages/shared/package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.exports = { '.': './dist/index.js' };
pkg.main = './dist/index.js';
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
