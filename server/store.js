import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export class Store {
  constructor(directory) { this.directory = resolve(directory); this.file = resolve(directory, 'world.json'); this.queue = Promise.resolve(); }
  async open() {
    await mkdir(this.directory, { recursive: true });
    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') {
        try { this.data = JSON.parse(await readFile(this.file + '.backup', 'utf8')); this.recovered = true; }
        catch { throw new Error('The world database and its backup cannot be read. Refusing to overwrite them.'); }
      } else this.data = { version: 1, users: [], sessions: {}, battles: {}, guilds: [], challenges: [], shares: [], live: { revision: 1, enabled: true, seasonName: null, announcements: [] } };
    }
    if (this.data.version !== 1) throw new Error('Unsupported world database version.');
    return this;
  }
  transaction(operation) {
    const next = this.queue.then(async () => {
      const draft = structuredClone(this.data);
      const result = await operation(draft);
      await writeFile(this.file + '.tmp', JSON.stringify(draft), { mode: 0o600 });
      if (!this.recovered) { try { await copyFile(this.file, this.file + '.backup'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
      await rename(this.file + '.tmp', this.file);
      this.data = draft;
      this.recovered = false;
      return result;
    });
    this.queue = next.catch(() => {});
    return next;
  }
}
