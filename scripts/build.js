import { cp, mkdir, readFile } from 'node:fs/promises';
import { validateContent } from '../src/data/content.js';
const issues = validateContent();
if (issues.length) throw new Error(issues.join('\n'));
const html = await readFile('index.html', 'utf8');
if (!html.includes('src/ui/app.js')) throw new Error('Missing client entry point.');
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'src', 'assets']) await cp(path, 'dist/' + path, { recursive: true });
console.log('Production site built in dist/. Content validation passed.');
