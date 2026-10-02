import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function prepareOfflineManifest() {
  const files = ['./', './index.html', './manifest.webmanifest'];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (!path.endsWith('offline-files.json')) files.push('./' + path.replaceAll('\\', '/'));
    }
  }
  await walk('src'); await walk('assets');
  await writeFile('assets/offline-files.json', JSON.stringify(files.sort(), null, 2) + '\n');
}
