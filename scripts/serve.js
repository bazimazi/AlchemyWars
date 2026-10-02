import { createAppServer } from '../server/http.js';
import { prepareOfflineManifest } from './offline.js';
if (!process.argv.includes('--dist')) await prepareOfflineManifest();
const port = Number(process.env.PORT ?? 5173);
const { server } = await createAppServer({ root: process.argv.includes('--dist') ? 'dist' : '.', dataDir: process.env.DATA_DIR ?? '.data' });
server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log('Alchemy Wars is ready at http://127.0.0.1:' + port));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
