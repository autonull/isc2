import fs from 'fs';
import path from 'path';

function findJsTsFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) results.push(...findJsTsFiles(full));
    else if (item.endsWith('.js') || item.endsWith('.ts')) results.push(full);
  }
  return results;
}

const srcDir = process.argv[2] || '.';
const files = findJsTsFiles(srcDir);
const fixes = [];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const importRegex = /(from\s+['"]|import\(['"])([^'"]+\.js)(['"])/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[2];
    const dir = path.dirname(file);
    const resolved = path.resolve(dir, importPath);
    if (!fs.existsSync(resolved)) {
      const tsPath = resolved.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsPath)) {
        const relative = path.relative(dir, tsPath);
        const newImport = relative.startsWith('.') ? relative : './' + relative;
        fixes.push({ file, old: match[2], new: newImport });
      }
    }
  }
}

if (fixes.length > 0) {
  console.log(`Found ${fixes.length} broken imports`);
}

for (const fix of fixes) {
  let content = fs.readFileSync(fix.file, 'utf8');
  content = content.split(fix.old).join(fix.new);
  fs.writeFileSync(fix.file, content);
  console.log(`Fixed: ${fix.file}  ${fix.old} -> ${fix.new}`);
}
