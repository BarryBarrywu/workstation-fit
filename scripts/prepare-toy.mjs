import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const artifactDirectory = fileURLToPath(new URL('../dist-toy/', import.meta.url));
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.xml']);
const packageRootReference = /(?:["'(=]|url\()\s*\/(?:_astro\/|brand\/|models\/|icon\.png)/;

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return nested.flat();
}

if (!(await stat(join(artifactDirectory, 'index.html'))).isFile()) {
  throw new Error('Toy artifact must contain index.html at its root.');
}

const artifactFiles = await filesBelow(artifactDirectory);
for (const path of artifactFiles.filter((file) => textExtensions.has(extname(file)))) {
  const original = await readFile(path, 'utf8');
  const prepared = original.replaceAll('/_astro/', './_astro/');
  if (packageRootReference.test(prepared)) {
    throw new Error(`Root-absolute package asset remains in ${relative(artifactDirectory, path)}.`);
  }
  if (prepared !== original) await writeFile(path, prepared);
}
