import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config.js');
const config = fs.readFileSync(configPath, 'utf8');
const activeImports = [...config.matchAll(/^\s*(?!\/\/)import\(['"]\.\/(.+?\.js)['"]\)/gm)].map(m => m[1]);
const quarantined = new Set([
  'advanced-suite.js',
  'information-delivery-ux-v4.js',
  'workflow-revision-polish.js'
]);

const errors = [];
const warnings = [];

for (const file of activeImports) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    errors.push(`${file}: imported by config.js but file does not exist`);
    continue;
  }
  const src = fs.readFileSync(full, 'utf8');

  if (quarantined.has(file)) {
    errors.push(`${file}: quarantined module must not be loaded in production`);
  }

  if (/\bsetInterval\s*\(/.test(src)) {
    errors.push(`${file}: long-lived setInterval polling is forbidden in production modules`);
  }

  const observerCount = (src.match(/new\s+MutationObserver\s*\(/g) || []).length;
  if (observerCount > 3) {
    warnings.push(`${file}: ${observerCount} MutationObservers detected; review for duplicate work`);
  }

  if (/\.observe\([^;]+\{[^}]*subtree\s*:\s*true[^}]*characterData\s*:\s*true[^}]*\}/s.test(src) ||
      /\.observe\([^;]+\{[^}]*characterData\s*:\s*true[^}]*subtree\s*:\s*true[^}]*\}/s.test(src)) {
    errors.push(`${file}: subtree + characterData MutationObserver is forbidden because it can self-trigger on UI writes`);
  }
}

console.log(`Stability gate checked ${activeImports.length} production modules.`);
for (const w of warnings) console.warn(`WARNING: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log('Stability gate passed.');
