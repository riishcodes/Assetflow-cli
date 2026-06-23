import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { optimizeImage } from '../core/optimizer.js';
import { setupTestWorkspace, cleanupTestWorkspace, getWorkspaceRoot } from './helpers.js';
import { getDefaultConfig } from '../config/schema.js';

describe('Image Optimizer Engine', () => {
  const root = getWorkspaceRoot('optimizer');

  beforeAll(async () => {
    await setupTestWorkspace('optimizer');
  });

  afterAll(async () => {
    await cleanupTestWorkspace('optimizer');
  });

  it('should optimize image to WebP format by default', async () => {
    const file = {
      absolutePath: path.join(root, 'public', 'images', 'hero.png'),
      relativePath: 'public/images/hero.png',
      extension: 'png',
    };

    const config = getDefaultConfig();
    config.format = 'webp';

    const result = await optimizeImage(file, config, root);

    expect(result.success).toBe(true);
    expect(result.optimizedFiles.length).toBe(1);
    expect(result.optimizedFiles[0].format).toBe('webp');
    expect(result.optimizedFiles[0].width).toBe(100);

    // Check that output WebP file exists on disk
    const expectedOutput = path.join(root, 'public', 'images', 'hero.webp');
    const exists = await fs.stat(expectedOutput).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should generate both WebP and AVIF formats when configured', async () => {
    const file = {
      absolutePath: path.join(root, 'src', 'avatar.jpg'),
      relativePath: 'src/avatar.jpg',
      extension: 'jpg',
    };

    const config = getDefaultConfig();
    config.format = 'both';

    const result = await optimizeImage(file, config, root);

    expect(result.success).toBe(true);
    expect(result.optimizedFiles.length).toBe(2);

    const formats = result.optimizedFiles.map(o => o.format);
    expect(formats).toContain('webp');
    expect(formats).toContain('avif');

    // Check files on disk
    const webpExists = await fs.stat(path.join(root, 'src', 'avatar.webp')).then(() => true).catch(() => false);
    const avifExists = await fs.stat(path.join(root, 'src', 'avatar.avif')).then(() => true).catch(() => false);
    expect(webpExists).toBe(true);
    expect(avifExists).toBe(true);
  });

  it('should generate responsive variants when responsive option is active', async () => {
    const file = {
      absolutePath: path.join(root, 'public', 'images', 'hero.png'),
      relativePath: 'public/images/hero.png',
      extension: 'png',
    };

    const config = getDefaultConfig();
    config.format = 'webp';
    config.responsive = true;
    config.sizes = [40, 80];

    const result = await optimizeImage(file, config, root);

    expect(result.success).toBe(true);
    expect(result.optimizedFiles.length).toBe(2);

    const widths = result.optimizedFiles.map(o => o.width);
    expect(widths).toContain(40);
    expect(widths).toContain(80);

    // Verify filenames contain the dimensions suffix
    const file40Exists = await fs.stat(path.join(root, 'public', 'images', 'hero-40.webp')).then(() => true).catch(() => false);
    const file80Exists = await fs.stat(path.join(root, 'public', 'images', 'hero-80.webp')).then(() => true).catch(() => false);
    expect(file40Exists).toBe(true);
    expect(file80Exists).toBe(true);
  });

  it('should calculate sizes in memory and not modify files during dry-run', async () => {
    const file = {
      absolutePath: path.join(root, 'src', 'avatar.jpg'),
      relativePath: 'src/avatar.jpg',
      extension: 'jpg',
    };

    const config = getDefaultConfig();
    config.format = 'webp';

    const webpPath = path.join(root, 'src', 'avatar.webp');
    await fs.unlink(webpPath).catch(() => {});

    const result = await optimizeImage(file, config, root, { dryRun: true });

    expect(result.success).toBe(true);
    expect(result.optimizedFiles[0].size).toBeGreaterThan(0);

    // Verify file is NOT created on disk
    const exists = await fs.stat(webpPath).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
