import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import toolMetadata from '../../apps/xhs-mini-tool/tool-metadata.json';

const artifactPath = resolve(`dist/xhs-mini-tool/jiuwei-xhs-mini-tool-${toolMetadata.toolVersion}.zip`);
const allowedExtensions = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json']);
let unpackedPath: string;

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

beforeAll(() => {
  unpackedPath = mkdtempSync(join(tmpdir(), 'jiuwei-xhs-artifact-'));
  execFileSync('unzip', ['-q', artifactPath, '-d', unpackedPath]);
});

afterAll(() => {
  if (unpackedPath) rmSync(unpackedPath, { recursive: true, force: true });
});

describe('Xiaohongshu upload artifact', () => {
  it('is a root-entry, allowlisted, self-contained classic-script package under 2 MB', () => {
    const files = walkFiles(unpackedPath);
    const paths = files.map((file) => relative(unpackedPath, file));
    const html = readFileSync(join(unpackedPath, 'index.html'), 'utf8');
    const metadata = JSON.parse(readFileSync(join(unpackedPath, 'tool-info.json'), 'utf8'));
    const source = files
      .filter((file) => ['.html', '.css', '.js', '.json'].includes(extname(file)))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(paths).toContain('index.html');
    expect(paths).toContain('assets/model-data.js');
    expect(paths).toContain('assets/scene-fallback.png');
    expect(paths.filter((path) => extname(path) === '.html')).toEqual(['index.html']);
    expect(paths.every((path) => allowedExtensions.has(extname(path).toLowerCase()))).toBe(true);
    expect(statSync(artifactPath).size).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(metadata).toEqual({
      name: '就位',
      description: '按身高，调桌椅与显示器',
      details: expect.stringMatching(/145–205 cm.*来源.*本地.*不是医疗建议/),
      version: '1.0.0',
      permissions: [],
      fitModelVersion: '2026.08.02',
      evidenceVerifiedAt: '2026-08-02',
    });
    expect(html).toMatch(/<script src="\.\/assets\/main\.js"><\/script>/);
    expect(html.indexOf('./assets/model-data.js')).toBeLessThan(html.indexOf('./assets/main.js'));
    expect(html).not.toMatch(/<script(?:\s|>)(?![^>]*\bsrc=)/i);
    expect(html).not.toMatch(/\son\w+\s*=|javascript:/i);
    expect(readFileSync(join(unpackedPath, 'assets/main.js'), 'utf8')).not.toMatch(/(^|[;}])\s*(?:import|export)\s/m);
    expect(source).not.toMatch(/\btype=["']module["']|\beval\s*\(|new\s+Function\s*\(|WebAssembly|\bfetch\s*\(|XMLHttpRequest|new\s+(?:Shared)?Worker\s*\(|serviceWorker|<iframe|<object/i);
    expect(source).not.toMatch(/navigator\.(?:mediaDevices|geolocation|clipboard)|requestFullscreen|window\.(?:open|prompt)\s*\(/i);
    expect(source).not.toMatch(/openstd\.samr|cnis\.ac\.cn|cornell\.edu|mayoclinic\.org|osha\.gov|ccohs\.ca/);

    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    expect(references.every((reference) => reference.startsWith('./') && !reference.includes('..'))).toBe(true);
    expect(references.every((reference) => paths.includes(normalize(join(dirname('index.html'), reference))))).toBe(true);
  });
});
