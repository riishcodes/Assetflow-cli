import prettyBytes from 'pretty-bytes';
import type { OptimizationResult } from '../core/optimizer.js';

export interface ReportSummary {
  totalImages: number;
  originalSize: number;
  optimizedSize: number;
  spaceSaved: number;
  averageReduction: number;
  largestAssets: { path: string; size: number }[];
  biggestSavings: { path: string; saved: number }[];
  failedFiles: { path: string; error: string }[];
  executionTimeMs: number;
}

/**
 * Computes overall metrics and summary data from optimization results.
 * @param results Array of individual file optimization results
 * @param executionTimeMs Total execution duration in milliseconds
 */
export function compileSummary(
  results: OptimizationResult[],
  executionTimeMs: number
): ReportSummary {
  let totalImages = 0;
  let originalSize = 0;
  let optimizedSize = 0;
  const failedFiles: { path: string; error: string }[] = [];

  const assetsSizes: { path: string; size: number }[] = [];
  const assetsSavings: { path: string; saved: number }[] = [];

  for (const res of results) {
    if (!res.success) {
      failedFiles.push({
        path: res.relativePath,
        error: res.error || 'Unknown error',
      });
      continue;
    }

    totalImages++;
    originalSize += res.originalSize;

    // Track the total size of all output files generated for this image
    let imageOutputSize = 0;
    for (const opt of res.optimizedFiles) {
      imageOutputSize += opt.size;
    }

    optimizedSize += imageOutputSize;

    const saved = res.originalSize - imageOutputSize;

    assetsSizes.push({
      path: res.relativePath,
      size: res.originalSize,
    });

    if (saved > 0) {
      assetsSavings.push({
        path: res.relativePath,
        saved,
      });
    }
  }

  const spaceSaved = Math.max(0, originalSize - optimizedSize);
  const averageReduction = originalSize > 0
    ? (spaceSaved / originalSize) * 100
    : 0;

  // Sort and select top items
  const largestAssets = assetsSizes
    .sort((a, b) => b.size - a.size)
    .slice(0, 3);

  const biggestSavings = assetsSavings
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 3);

  return {
    totalImages,
    originalSize,
    optimizedSize,
    spaceSaved,
    averageReduction,
    largestAssets,
    biggestSavings,
    failedFiles,
    executionTimeMs,
  };
}

/**
 * Formats a byte number to human-readable string.
 */
export function formatSize(bytes: number): string {
  return prettyBytes(bytes);
}

/**
 * Calculates percentage reduction.
 */
export function getReductionPercentage(original: number, optimized: number): number {
  if (original <= 0) return 0;
  const saved = original - optimized;
  return Math.round((saved / original) * 100);
}
