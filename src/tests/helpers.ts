import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Returns a unique test workspace root path based on the test suite name.
 */
export function getWorkspaceRoot(suiteName: string): string {
  return path.resolve(process.cwd(), `test-workspace-${suiteName}`);
}

/**
 * Sets up a clean, isolated test directory structure with mock image assets.
 */
export async function setupTestWorkspace(suiteName: string): Promise<string> {
  const root = getWorkspaceRoot(suiteName);
  
  // Clean up any stale workspace
  await cleanupTestWorkspace(suiteName);

  const directories = [
    root,
    path.join(root, 'src'),
    path.join(root, 'public', 'images'),
    path.join(root, 'assets'),
    path.join(root, 'node_modules', 'ignored_dep'),
  ];

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create mock PNG image (100x100px red canvas)
  const pngPath = path.join(root, 'public', 'images', 'hero.png');
  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toFile(pngPath);

  // Create mock JPG image (50x50px blue canvas)
  const jpgPath = path.join(root, 'src', 'avatar.jpg');
  await sharp({
    create: {
      width: 50,
      height: 50,
      channels: 3,
      background: { r: 0, g: 0, b: 255 },
    },
  })
    .jpeg()
    .toFile(jpgPath);

  // Create ignored PNG inside node_modules to verify scanner ignores it
  const ignoredPngPath = path.join(
    root,
    'node_modules',
    'ignored_dep',
    'logo.png'
  );
  await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .png()
    .toFile(ignoredPngPath);

  return root;
}

/**
 * Removes the test workspace directory recursively.
 */
export async function cleanupTestWorkspace(suiteName: string): Promise<void> {
  const root = getWorkspaceRoot(suiteName);
  try {
    await fs.rm(root, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
