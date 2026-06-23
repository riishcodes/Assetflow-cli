import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanDirectories } from '../core/scanner.js';
import { setupTestWorkspace, cleanupTestWorkspace, getWorkspaceRoot } from './helpers.js';

describe('Recursive Image Scanner', () => {
  const root = getWorkspaceRoot('scanner');

  beforeAll(async () => {
    await setupTestWorkspace('scanner');
  });

  afterAll(async () => {
    await cleanupTestWorkspace('scanner');
  });

  it('should find candidate source images in configured folders', async () => {
    const files = await scanDirectories(root);

    // Should find src/avatar.jpg and public/images/hero.png
    expect(files.length).toBeGreaterThanOrEqual(2);

    const relativePaths = files.map((f) => f.relativePath);
    expect(relativePaths).toContain('public/images/hero.png');
    expect(relativePaths).toContain('src/avatar.jpg');
  });

  it('should strictly ignore files inside node_modules directory', async () => {
    const files = await scanDirectories(root);
    const relativePaths = files.map((f) => f.relativePath);

    // Verify node_modules file is excluded
    const hasIgnoredDep = relativePaths.some(p => p.includes('node_modules'));
    expect(hasIgnoredDep).toBe(false);
  });

  it('should respect custom directories list', async () => {
    const files = await scanDirectories(root, {
      directories: ['src'],
    });

    const relativePaths = files.map((f) => f.relativePath);
    expect(relativePaths).toContain('src/avatar.jpg');
    expect(relativePaths).not.toContain('public/images/hero.png');
  });

  it('should respect custom ignore patterns', async () => {
    const files = await scanDirectories(root, {
      ignore: ['src'],
    });

    const relativePaths = files.map((f) => f.relativePath);
    expect(relativePaths).not.toContain('src/avatar.jpg');
    expect(relativePaths).toContain('public/images/hero.png');
  });
});
