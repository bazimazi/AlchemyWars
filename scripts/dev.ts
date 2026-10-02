import { watch } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

// Rebuild source changes serially and restart only this watcher's server process.
let server: ChildProcess | undefined;
let building = false, pending = false, closing = false;
let debounce: ReturnType<typeof setTimeout>;
const watchers: ReturnType<typeof watch>[] = [];
async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const child = server;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
  server = undefined;
}
function launch() {
  if (closing) return;
  server = spawn(process.execPath, ['.build/scripts/serve.js'], { stdio: 'inherit', windowsHide: true });
  server.on('error', error => console.error(error.message));
}
async function run(args: string[]) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error('Build failed; fix the error and save to retry.');
}
async function rebuild() {
  if (closing) return;
  if (building) { pending = true; return; }
  building = true;
  do {
    pending = false;
    try {
      await run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
      await run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.worker.json']);
      if (closing) break;
      await stopServer();
      await run(['.build/scripts/build.js']);
      launch();
    } catch (error) { console.error(error instanceof Error ? error.message : error); }
  } while (pending && !closing);
  building = false;
}
for (const path of ['src', 'server', 'scripts', 'assets', 'index.html', 'sw.ts', 'manifest.webmanifest', 'tsconfig.json', 'tsconfig.worker.json']) {
  watchers.push(watch(path, { recursive: ['src','server','scripts','assets'].includes(path) }, () => {
    clearTimeout(debounce); debounce = setTimeout(() => { void rebuild(); }, 150);
  }));
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  closing = true; clearTimeout(debounce); watchers.forEach(w => w.close()); void stopServer();
});
launch();
console.log('Watching TypeScript, styles and content. Refresh the browser after each successful build.');
