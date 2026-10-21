import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';

const output = path.resolve('local-browser/reports/button-inventory');
fs.mkdirSync(output, { recursive: true });
const sourceRoot = 'apps/web/src';
const classes = new Set(['button', 'primary', 'danger']);
const elements = [];
for (const name of fs.readdirSync(sourceRoot).filter(n => n.endsWith('.tsx'))) {
  const file = sourceRoot + '/' + name;
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const attr = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'className');
      const tokens = [];
      function strings(n) {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) tokens.push(...n.text.split(/\s+/));
        ts.forEachChild(n, strings);
      }
      if (attr?.initializer) strings(attr.initializer);
      if (tag === 'button' || tokens.includes('button')) {
        tokens.filter(Boolean).forEach(c => classes.add(c));
        elements.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, tag,
          classes: tokens.filter(Boolean), source: node.getText(source).slice(0, 250) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const related = new RegExp('\\bbutton\\b|\\.(?:' + [...classes].map(escape).join('|') + ')\\b|\\[role\\s*=\\s*["\x27]?(?:tab|button)');
const sheets = ['apps/web/src/styles.css', 'apps/web/src/os-theme.css'].map(file => {
  const rules = [];
  postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }).walkRules(rule => {
    const globalFocus = rule.selector.trim() === ':focus-visible';
    const globalMotion = rule.selector.includes('*') && rule.nodes.some(n => n.type === 'decl' && /^(transition|animation)/.test(n.prop));
    if (!related.test(rule.selector) && !globalFocus && !globalMotion) return;
    const conditions = [];
    for (let p = rule.parent; p; p = p.parent) if (p.type === 'atrule') conditions.unshift('@' + p.name + ' ' + p.params);
    rules.push({ selector: rule.selector.replace(/\s+/g, ' '), line: rule.source.start.line, conditions,
      declarations: rule.nodes.filter(n => n.type === 'decl').map(d => ({ property: d.prop, value: d.value, important: !!d.important, line: d.source.start.line })) });
  });
  return { file, rules };
});
const stats = {
  jsxSites: elements.length,
  tags: Object.fromEntries([...new Set(elements.map(e => e.tag))].map(tag => [tag, elements.filter(e => e.tag === tag).length])),
  components: Object.fromEntries([...new Set(elements.map(e => e.file))].map(file => [file, elements.filter(e => e.file === file).length])),
  sheets: sheets.map(s => ({ file: s.file, relatedRules: s.rules.length,
    hover: s.rules.filter(r => r.selector.includes(':hover')).length,
    focus: s.rules.filter(r => r.selector.includes(':focus')).length,
    active: s.rules.filter(r => r.selector.includes(':active')).length,
    importantDeclarations: s.rules.flatMap(r => r.declarations).filter(d => d.important).length })),
};
const inventory = { generatedAt: new Date().toISOString(), stats, buttonClasses: [...classes].sort(),
  method: 'JSX opening sites, not rendered instance counts. CSS candidates match button tags, role tab/button, or classes found on these JSX sites, plus universal focus and motion rules. Includes descendant rules; not all candidates are effective in every context. No computed cascade or dead-rule removal is inferred.',
  importOrder: ['apps/web/src/styles.css', 'apps/web/src/os-theme.css'], elements, sheets };
fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(inventory, null, 2));
const csv = value => '"' + String(value).replaceAll('"', '""') + '"';
const lines = [['file', 'line', 'condition', 'selector', 'property', 'value', 'important'].map(csv).join(',')];
for (const sheet of sheets) for (const rule of sheet.rules) for (const d of rule.declarations) {
  lines.push([sheet.file, d.line, rule.conditions.join(' / '), rule.selector, d.property, d.value, d.important].map(csv).join(','));
}
fs.writeFileSync(path.join(output, 'declarations.csv'), '\ufeff' + lines.join('\r\n'));
console.log(JSON.stringify(stats, null, 2));
