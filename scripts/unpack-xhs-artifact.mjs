import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { toolVersion } = JSON.parse(readFileSync(resolve(root, 'apps/xhs-mini-tool/tool-metadata.json'), 'utf8'));
const artifact = resolve(root, `dist/xhs-mini-tool/jiuwei-xhs-mini-tool-${toolVersion}.zip`);
const destination = resolve(root, 'dist/xhs-mini-tool/unpacked');

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
execFileSync('unzip', ['-q', artifact, '-d', destination]);
