import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'apps/xhs-mini-tool');
const outputRoot = resolve(root, 'dist/xhs-mini-tool');
const packageRoot = resolve(outputRoot, 'package');
const assetsRoot = resolve(packageRoot, 'assets');
const toolMetadata = JSON.parse(readFileSync(resolve(source, 'tool-metadata.json'), 'utf8'));
const artifact = resolve(outputRoot, `jiuwei-xhs-mini-tool-${toolMetadata.toolVersion}.zip`);

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(assetsRoot, { recursive: true });
copyFileSync(resolve(source, 'index.html'), resolve(packageRoot, 'index.html'));
copyFileSync(resolve(source, 'styles.css'), resolve(assetsRoot, 'style.css'));
const modelMetadata = JSON.parse(readFileSync(resolve(root, 'src/lib/fit-model-metadata.json'), 'utf8'));
writeFileSync(resolve(packageRoot, 'tool-info.json'), `${JSON.stringify({
  name: toolMetadata.name,
  description: toolMetadata.description,
  details: toolMetadata.details,
  version: toolMetadata.toolVersion,
  permissions: toolMetadata.permissions,
  ...modelMetadata,
}, null, 2)}\n`);
copyFileSync(resolve(root, 'public/icon.png'), resolve(assetsRoot, 'icon.png'));

await build({
  entryPoints: [resolve(source, 'main.ts')],
  outfile: resolve(assetsRoot, 'main.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['ios15', 'chrome100'],
  minify: true,
  legalComments: 'none',
});

execFileSync('zip', ['-q', '-r', artifact, '.'], { cwd: packageRoot });
const size = readFileSync(artifact).byteLength;
if (size > 2 * 1024 * 1024) throw new Error(`Xiaohongshu artifact exceeds 2 MB: ${size} bytes`);

console.log(`Built ${artifact} (${size} bytes)`);
