/**
 * Local authoring launcher.
 *
 * The editor used to run a second HTTP implementation with its own unbounded,
 * unauthenticated level API. Keeping one server avoids security and behavior
 * drift while the editor is migrated into the main game shell.
 */
import { GameServer } from './server.js';

const requestedPort = Number.parseInt(process.env.EDITOR_PORT || '3001', 10);
const editorPort = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
  ? requestedPort
  : 3001;
const editorHost = process.env.EDITOR_HOST || '127.0.0.1';

const server = new GameServer();

server.start(editorPort, editorHost)
  .then(({ port }) => {
    console.log(`[Dropfall] Local editor: http://localhost:${port}/editor`);
    if (!process.env.DROPFALL_EDITOR_TOKEN) {
      console.warn('[Dropfall] Level deletion is disabled until DROPFALL_EDITOR_TOKEN is configured.');
    }
  })
  .catch(error => {
    console.error('[Dropfall] Failed to start local editor:', error.message);
    process.exitCode = 1;
  });

let stopping = false;
const shutdown = async signal => {
  if (stopping) return;
  stopping = true;
  console.log(`[Dropfall] ${signal} received, shutting down editor`);
  await server.stop();
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
