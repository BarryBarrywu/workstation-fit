import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = 4322;
const mountPath = '/toy/jiuwei/';
const artifactDirectory = fileURLToPath(new URL('../dist-toy/', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  const requestPath = new URL(request.url ?? '/', `http://${host}`).pathname;
  if (!requestPath.startsWith(mountPath)) {
    response.writeHead(404).end();
    return;
  }

  const relativePath = requestPath.slice(mountPath.length) || 'index.html';
  const normalizedPath = normalize(relativePath);
  if (normalizedPath.startsWith(`..${sep}`) || normalizedPath === '..') {
    response.writeHead(404).end();
    return;
  }

  const filePath = join(artifactDirectory, normalizedPath);
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, host, () => {
  process.stdout.write(`Toy artifact available at http://${host}:${port}${mountPath}\n`);
});
