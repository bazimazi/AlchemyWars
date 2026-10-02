import { resolve, dirname, basename, join } from 'node:path';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { validateContent } from '../src/data/content.js';
import { prepareOfflineManifest } from './offline.js';

import { installContentPack } from '../src/core/content-tools.js';
for (const pack of JSON.parse(await readFile('assets/content-packs.json', 'utf8'))) installContentPack(pack);
const issues = validateContent();
if (issues.length) throw new Error(issues.join('\n'));
const html = await readFile('index.html', 'utf8');
if (!html.includes('src/ui/app.js')) throw new Error('Missing client entry point.');
const destination = resolve('dist');
if (dirname(destination) !== resolve('.') || basename(destination) !== 'dist') throw new Error('Invalid build directory.');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const path of ['index.html', 'assets', 'manifest.webmanifest']) await cp(path, 'dist/' + path, { recursive: true });
// Copy only outputs with a current source, so removed modules cannot survive a rebuild.
async function publishSource(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) await publishSource(source);
    else if (source.endsWith('.ts') && !source.endsWith('.d.ts')) {
      const output = source.slice(0, -3) + '.js';
      await mkdir(dirname(join('dist', output)), { recursive: true });
      await cp(join('.build', output), join('dist', output));
    } else if (source.endsWith('.css')) {
      await mkdir(dirname(join('dist', source)), { recursive: true });
      await cp(source, join('dist', source));
    }
  }
}
await publishSource('src');
await cp('.build/sw.js', 'dist/sw.js');
await prepareOfflineManifest('dist');
console.log('Production site built in dist/. Content validation passed.');
