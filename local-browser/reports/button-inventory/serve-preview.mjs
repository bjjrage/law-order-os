import { copyFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const from = resolve('local-browser/reports/button-inventory');
const to = resolve('dist/web');
await access(resolve(to, 'index.html'));
for (const [source, target] of [
  ['preview.html', 'button-lab.html'],
  ['button-lab.css', 'button-lab.css'],
  ['button-lab.js', 'button-lab.js'],
  ['inventory.json', 'button-inventory.json'],
  ['declarations.csv', 'button-declarations.csv'],
]) await copyFile(resolve(from, source), resolve(to, target));
console.log('http://127.0.0.1:4313/button-lab.html');
