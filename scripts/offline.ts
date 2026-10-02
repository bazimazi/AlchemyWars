import { readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
export async function prepareOfflineManifest(root = 'dist') {
  const files = ['./', './index.html', './manifest.webmanifest'];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (!path.endsWith('offline-files.json') && !path.endsWith('.map')) files.push('./' + relative(root, path).replaceAll('\\', '/'));
    }
  }
  await walk(join(root, 'src')); await walk(join(root, 'assets'));
  await writeFile(join(root, 'assets/offline-files.json'), JSON.stringify(files.sort(), null, 2) + '\n');
}
