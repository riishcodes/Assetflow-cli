import fs from 'node:fs/promises';
import path from 'node:path';
import { formatSize } from '../utils/metrics.js';

export interface CacheData {
  images: number;
  totalSize: string;
  totalSizeBytes?: number;
  healthScore: number;
  timestamp: string;
  hashes: Record<string, string>;
}

/**
 * Loads cached fingerprint details if available.
 * @param projectRoot Root directory of the project
 * @returns Cached data or null if not present/corrupt
 */
export async function readCache(projectRoot: string): Promise<CacheData | null> {
  const cachePath = path.join(projectRoot, '.assetflow', 'cache.json');
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as CacheData;
    // Enforce fallback value for hashes dictionary
    if (!parsed.hashes) {
      parsed.hashes = {};
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Writes or updates the cache fingerprint in .assetflow/cache.json.
 * @param projectRoot Root directory of the project
 * @param data Metrics to cache
 */
export async function writeCache(projectRoot: string, data: Omit<CacheData, 'timestamp'>): Promise<void> {
  const cacheDir = path.join(projectRoot, '.assetflow');
  const cachePath = path.join(cacheDir, 'cache.json');

  try {
    // Ensure cache directory exists
    await fs.mkdir(cacheDir, { recursive: true });

    const fullData: CacheData = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(cachePath, JSON.stringify(fullData, null, 2), 'utf8');
  } catch (error) {
    // Ignore cache writing errors during normal operations to avoid halting execution
  }
}

/**
 * Helper to compute cache delta comparison between current run and historical cache.
 */
export interface CacheComparison {
  previousScore: number | null;
  currentScore: number;
  scoreImprovement: number | null;
  sizeSavedBytes: number | null;
  imageCountDelta: number | null;
}

export function compareCache(currentScore: number, currentSize: number, currentImages: number, previous: CacheData | null): CacheComparison {
  if (!previous) {
    return {
      previousScore: null,
      currentScore,
      scoreImprovement: null,
      sizeSavedBytes: null,
      imageCountDelta: null,
    };
  }

  const scoreImprovement = currentScore - previous.healthScore;

  // Compute size saved using raw bytes if available, or fall back to 0
  const prevBytes = previous.totalSizeBytes !== undefined ? previous.totalSizeBytes : 0;
  const sizeSavedBytes = prevBytes > 0 ? Math.max(0, prevBytes - currentSize) : null;
  const imageCountDelta = currentImages - previous.images;

  return {
    previousScore: previous.healthScore,
    currentScore,
    scoreImprovement,
    sizeSavedBytes,
    imageCountDelta,
  };
}
