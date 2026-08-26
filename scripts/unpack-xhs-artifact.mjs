import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifact = resolve(root, 'dist/xhs-mini-tool/jiuwei-xhs-mini-tool-1.0.0.zip');
const destination = resolve(root, 'dist/xhs-mini-tool/unpacked');

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
execFileSync('unzip', ['-q', artifact, '-d', destination]);
