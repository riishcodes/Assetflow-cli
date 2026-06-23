import chokidar from 'chokidar';
import path from 'node:path';
import type { AssetFlowConfig } from '../config/schema.js';
import { optimizeImage, type OptimizationResult } from './optimizer.js';

export interface WatcherInstance {
  close: () => Promise<void>;
}

/**
 * Starts a real-time file watcher on configured directories to optimize new/modified images.
 * @param projectRoot Base directory of the project
 * @param config Configuration options
 * @param onResult Callback executed after a file is optimized
 */
export function startWatcher(
  projectRoot: string,
  config: AssetFlowConfig,
  onResult: (result: OptimizationResult) => void
): WatcherInstance {
  const dirs = config.directories && config.directories.length > 0
    ? config.directories
    : ['src', 'public', 'assets', 'images'];

  // Resolve watch directories relative to project root
  const watchPaths = dirs.map(dir => path.resolve(projectRoot, dir));

  // Chokidar options
  const watcher = chokidar.watch(watchPaths, {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      ...config.ignore.map(pattern => {
        // Simple conversion from generic patterns to Chokidar format regex/globs
        return `**/${pattern}/**`;
      })
    ],
    persistent: true,
    ignoreInitial: true, // do not run on existing files on start
    awaitWriteFinish: {
      stabilityThreshold: 1000, // wait until file size is stable for 1s
      pollInterval: 100,
    },
  });

  // Track active jobs to prevent concurrent duplicate runs on the same file
  const activeJobs = new Set<string>();

  const handleFileChange = async (filePath: string) => {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const sourceFormats = ['png', 'jpg', 'jpeg'];

    // Only process PNG, JPG, JPEG to prevent infinite loop on WebP/AVIF output creations
    if (!sourceFormats.includes(ext)) {
      return;
    }

    if (activeJobs.has(filePath)) {
      return;
    }

    activeJobs.add(filePath);

    try {
      const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
      const scanned = {
        absolutePath: path.resolve(filePath),
        relativePath: relPath,
        extension: ext,
      };

      const result = await optimizeImage(scanned, config, projectRoot, { dryRun: false });
      onResult(result);
    } catch {
      // Ignore watch run processing errors to keep watcher alive
    } finally {
      activeJobs.delete(filePath);
    }
  };

  watcher.on('add', handleFileChange);
  watcher.on('change', handleFileChange);

  return {
    close: async () => {
      await watcher.close();
    },
  };
}
