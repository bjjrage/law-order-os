import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import postcss from 'postcss';

const report = path.resolve('local-browser/reports/ink-buttons');
fs.mkdirSync(path.join(report, 'before'), { recursive: true });
fs.mkdirSync(path.join(report, 'staged'), { recursive: true });
const buttonClasses = ['button', 'primary', 'nav-item', 'text-button', 'text-action', 'sidebar-toggle', 'summary-control', 'client-filter-chip', 'document-remove', 'document-upload', 'specialist-persona'];
function segments(selector, commas = false) {
  const parts = []; let depth = 0, quote = '', start = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) { if (c === quote && selector[i - 1] !== '\\') quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (!depth && (commas ? c === ',' : /[\s>+~]/.test(c))) {
      if (selector.slice(start, i).trim()) parts.push(selector.slice(start, i).trim()); start = i + 1;
    }
  }
  if (selector.slice(start).trim()) parts.push(selector.slice(start).trim());
  return parts;
}
function directButton(selector) {
  const last = segments(selector).at(-1) ?? '';
  // Shared field/link focus selectors remain for those controls; the new sheet
  // provides the more specific button focus rule.
  if (/:is\([^)]*(?:\binput\b|\bselect\b|\btextarea\b|\bsummary\b)/.test(last)) return false;
  return /^(?:button|(?:a|label)\.button)(?:[.#:[\s]|$)/.test(last)
    || /^\[role\s*=\s*["']?(?:tab|button)["']?\]/.test(last)
    || buttonClasses.some(cls => new RegExp('^\\.' + cls + '(?:[.#:[\\s]|$)').test(last))
    || last.startsWith(':is(') && /(?:^|[,(])\s*(?:button|\.button)(?:[.#:[,\s]|$)/.test(last);
}
const paint = /^(?:background(?:-.+)?|color|border(?:-(?:top|right|bottom|left))?-color|outline(?:-.+)?|box-shadow|transform|transition(?:-.+)?|opacity|cursor|text-decoration(?:-.+)?|text-underline-offset)$/;
const changes = [], patches = [];
for (const file of ['apps/web/src/styles.css', 'apps/web/src/os-theme.css']) {
  const before = fs.readFileSync(file, 'utf8');
  const root = postcss.parse(before, { from: file });
  root.walkRules(rule => {
    const selectors = segments(rule.selector, true);
    const direct = selectors.filter(directButton);
    if (!direct.length) return;
    const other = selectors.filter(s => !directButton(s));
    const declarations = rule.nodes.filter(n => n.type === 'decl' && (paint.test(n.prop) || /^border(?:-(?:top|right|bottom|left))?$/.test(n.prop)));
    if (!declarations.length) return;
    if (other.length) { const keep = rule.clone({ selector: other.join(', ') }); rule.parent.insertBefore(rule, keep); rule.selector = direct.join(', '); }
    for (const d of declarations) {
      changes.push({ file, line: d.source.start.line, selector: rule.selector, property: d.prop, previous: d.value, important: !!d.important });
      if (/^border(?:-(?:top|right|bottom|left))?$/.test(d.prop)) {
        // Keep divider/selection geometry; appearance is supplied centrally.
        d.value = d.value.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b|var\(--(?:ink|paper|line|brass)\)/gi, 'transparent');
        d.important = false;
      } else d.remove();
    }
    if (!rule.nodes.length) rule.remove();
  });
  const after = root.toString();
  const oldPath = path.join(report, 'before', path.basename(file));
  const currentPath = path.join(report, 'staged', path.basename(file) + '.input');
  const newPath = path.join(report, 'staged', path.basename(file));
  if (!fs.existsSync(oldPath)) fs.writeFileSync(oldPath, before);
  fs.writeFileSync(currentPath, before);
  fs.writeFileSync(newPath, after);
  const diff = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--', currentPath, newPath], { encoding: 'utf8' });
  if (diff.status !== 0 && diff.status !== 1) throw Error(diff.stderr);
  const hunks = diff.stdout.split('\n').filter(line => !line.startsWith('diff --git') && !line.startsWith('index ') && !line.startsWith('--- ') && !line.startsWith('+++ ') && !line.startsWith('\\ No newline')).map(line => line.startsWith('@@ ') ? '@@' : line).join('\n').trimEnd();
  if (hunks) patches.push({ file, patch: '*** Begin Patch\n*** Update File: ' + file + '\n' + hunks + '\n*** End Patch' });
}
const historyPath = path.join(report, 'retired-declarations.json');
const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : [];
fs.writeFileSync(historyPath, JSON.stringify([...history, ...changes], null, 2));
process.stdout.write(JSON.stringify(patches));
