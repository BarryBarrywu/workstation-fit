import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectDirectory = process.cwd();

function runBuild(script: 'build' | 'build:toy', environment = process.env) {
  execFileSync('npm', ['run', script], {
    cwd: projectDirectory,
    env: environment,
    stdio: 'pipe',
  });
}

function snapshot(directory: string) {
  const values = new Map<string, string>();
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else values.set(relative(directory, entryPath), createHash('sha256').update(readFileSync(entryPath)).digest('hex'));
    }
  };
  visit(directory);
  return values;
}

describe('platform build isolation', () => {
  it('keeps Toy output separate while preserving website and China behavior', () => {
    runBuild('build');
    const websiteArtifact = join(projectDirectory, 'dist');
    const websiteSnapshot = snapshot(websiteArtifact);
    const websiteHtml = readFileSync(join(websiteArtifact, 'index.html'), 'utf8');
    expect(websiteHtml).toContain('id="episode"');
    expect(websiteHtml).toContain('id="related-links"');
    expect(websiteHtml).toContain('href="/icon.png"');

    runBuild('build:toy');
    expect(snapshot(websiteArtifact)).toEqual(websiteSnapshot);
    const toyHtml = readFileSync(join(projectDirectory, 'dist-toy/index.html'), 'utf8');
    expect(toyHtml).not.toContain('id="episode"');
    expect(toyHtml).not.toContain('id="related-links"');
    expect(toyHtml).toContain('href="./icon.png"');
    expect(toyHtml).toContain('src="./_astro/');

    runBuild('build', {
      ...process.env,
      SITE_REGION: 'cn',
      PUBLIC_ICP_NUMBER: '测试备案号',
    });
    const chinaHtml = readFileSync(join(websiteArtifact, 'index.html'), 'utf8');
    expect(chinaHtml).toContain('测试备案号');
    expect(chinaHtml).toContain('href="/icon.png"');
    expect(chinaHtml).toContain('id="episode"');

    runBuild('build');
  }, 60_000);
});
