const fs = require('node:fs');
const path = require('node:path');
const files = ['src/styles.scss', 'src/global.scss'];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(scss|html|ts)$/.test(p) && !p.endsWith('.spec.ts')) files.push(p);
  }
}
walk('src/app');
const definitions = new Set();
for (const p of files) for (const m of fs.readFileSync(p, 'utf8').matchAll(/(--[\w-]+)\s*:/g)) definitions.add(m[1]);
const missing = [];
for (const p of files) fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/var\((--[\w-]+)\s*\)/g)) {
    if (!m[1].startsWith('--ion-') && !definitions.has(m[1])) missing.push(p + ':' + (i + 1) + ' ' + m[1]);
  }
});
if (missing.length) { console.error('Undefined design tokens:\n' + missing.join('\n')); process.exitCode = 1; }
else console.log('Design token check passed (' + files.length + ' files).');
