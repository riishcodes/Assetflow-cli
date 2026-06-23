import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { AssetFlowConfig } from '../config/schema.js';
import type { ScannedFile } from './scanner.js';
import { getFileHash } from './hash.js';

export interface OptimizedFileResult {
  outputPath: string;
  relativePath: string;
  size: number;
  format: 'webp' | 'avif';
  width: number | null;
  height: number | null;
}

export interface OptimizationResult {
  originalPath: string;
  relativePath: string;
  originalSize: number;
  optimizedFiles: OptimizedFileResult[];
  success: boolean;
  error: string | null;
  hash?: string;
  skipped?: boolean;
}

/**
 * Calculates adaptive quality based on original file size and dimensions.
 */
function getAdaptiveQuality(
  originalSize: number,
  width: number,
  baseQuality: number
): number {
  let quality = baseQuality;

  // Reduce quality slightly for very large files/dimensions (unnoticeable visually, huge savings)
  if (originalSize > 2 * 1024 * 1024 || width > 3000) {
    quality = Math.max(50, quality - 8);
  } else if (originalSize > 1024 * 1024 || width > 2000) {
    quality = Math.max(60, quality - 4);
  }

  // Preserve details in tiny images by keeping quality high
  if (originalSize < 50 * 1024) {
    quality = Math.min(98, quality + 5);
  }

  return Math.round(quality);
}

/**
 * Optimizes a single image file, creating WebP, AVIF, or both formats,
 * including optional responsive variants.
 * 
 * @param file Scanned image file details
 * @param config Configuration options
 * @param projectRoot Root directory of the project
 * @param options Mode settings (e.g. dryRun, cachedHash)
 */
export async function optimizeImage(
  file: ScannedFile,
  config: AssetFlowConfig,
  projectRoot: string,
  options: { dryRun?: boolean; cachedHash?: string } = {}
): Promise<OptimizationResult> {
  const result: OptimizationResult = {
    originalPath: file.absolutePath,
    relativePath: file.relativePath,
    originalSize: 0,
    optimizedFiles: [],
    success: false,
    error: null,
  };

  try {
    const stats = await fs.stat(file.absolutePath);
    result.originalSize = stats.size;

    // Load image into sharp metadata inspector
    const sharpInstance = sharp(file.absolutePath);
    const metadata = await sharpInstance.metadata();

    const originalWidth = metadata.width || 1920;
    const originalHeight = metadata.height || 1080;

    // Determine formats to output
    const formats: ('webp' | 'avif')[] = [];
    if (config.format === 'both') {
      formats.push('webp', 'avif');
    } else {
      formats.push(config.format);
    }

    // Determine target widths (sizes) to generate
    const targets: { width: number | null; label: string }[] = [];

    if (config.responsive && config.sizes && config.sizes.length > 0) {
      for (const size of config.sizes) {
        // Only generate widths less than or equal to original width (no upscaling)
        if (size <= originalWidth) {
          targets.push({ width: size, label: `-${size}` });
        }
      }
      // If all configured sizes are larger than the original image, output at original size
      if (targets.length === 0) {
        targets.push({ width: null, label: '' });
      }
    } else {
      targets.push({ width: null, label: '' });
    }

    const dirName = path.dirname(file.absolutePath);
    const baseName = path.basename(file.absolutePath, path.extname(file.absolutePath));

    // Caching/Skip Check Hashing
    const currentHash = await getFileHash(file.absolutePath);
    result.hash = currentHash;

    if (!config.force && options.cachedHash === currentHash) {
      // Check if all expected files exist
      let allExist = true;
      const cachedFiles: OptimizedFileResult[] = [];
      for (const format of formats) {
        for (const target of targets) {
          const outputExt = `.${format}`;
          const outputFilename = `${baseName}${target.label}${outputExt}`;
          const outputPath = path.join(dirName, outputFilename);
          const relativeOutputPath = path.relative(projectRoot, outputPath).replace(/\\/g, '/');

          try {
            const outStats = await fs.stat(outputPath);
            const targetWidth = target.width || originalWidth;
            const targetHeight = target.width
              ? Math.round((originalHeight / originalWidth) * target.width)
              : originalHeight;

            cachedFiles.push({
              outputPath,
              relativePath: relativeOutputPath,
              size: outStats.size,
              format,
              width: targetWidth,
              height: targetHeight,
            });
          } catch {
            allExist = false;
            break;
          }
        }
        if (!allExist) break;
      }

      if (allExist) {
        result.optimizedFiles = cachedFiles;
        result.success = true;
        result.skipped = true;
        return result;
      }
    }

    // Process formats and targets combinations
    for (const format of formats) {
      for (const target of targets) {
        let pipeline = sharp(file.absolutePath);

        // Strip or keep metadata (EXIF, GPS, etc.)
        if (config.keepMetadata) {
          pipeline = pipeline.keepMetadata();
        }

        // Apply aspect-ratio preserving resizing
        let targetWidth: number | null = null;
        let targetHeight: number | null = null;

        if (target.width) {
          targetWidth = target.width;
          // Calculate proportional height to log accurately
          targetHeight = Math.round((originalHeight / originalWidth) * target.width);
          pipeline = pipeline.resize({
            width: targetWidth,
            withoutEnlargement: true,
          });
        } else {
          targetWidth = originalWidth;
          targetHeight = originalHeight;
        }

        // Calculate adaptive quality for this specific output format and size
        const adaptiveQuality = getAdaptiveQuality(
          result.originalSize,
          targetWidth,
          config.quality
        );

        // Apply format-specific encoding settings
        if (format === 'webp') {
          pipeline = pipeline.webp({ quality: adaptiveQuality });
        } else {
          pipeline = pipeline.avif({ quality: adaptiveQuality });
        }

        // Output destination path
        const outputExt = `.${format}`;
        const outputFilename = `${baseName}${target.label}${outputExt}`;
        const outputPath = path.join(dirName, outputFilename);
        const relativeOutputPath = path.relative(projectRoot, outputPath).replace(/\\/g, '/');

        let outputSize = 0;

        if (options.dryRun) {
          // Process in-memory buffer to check exact size for dry-run estimation
          const buffer = await pipeline.toBuffer();
          outputSize = buffer.length;
        } else {
          // Write directly to file
          await pipeline.toFile(outputPath);
          const outStats = await fs.stat(outputPath);
          outputSize = outStats.size;
        }

        result.optimizedFiles.push({
          outputPath,
          relativePath: relativeOutputPath,
          size: outputSize,
          format,
          width: targetWidth,
          height: targetHeight,
        });
      }
    }

    // Delete original file if configured and not a dry run
    if (config.deleteOriginal && !options.dryRun) {
      await fs.unlink(file.absolutePath);
    }

    result.success = true;
  } catch (err: any) {
    result.success = false;
    result.error = err.message || String(err);
  }

  return result;
}
