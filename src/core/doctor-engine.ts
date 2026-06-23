import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ScannedFile } from './scanner.js';

export interface DoctorReport {
  healthScore: number;
  totalSize: number;
  totalImages: number;
  potentialSavingsBytes: number;
  largestAssets: { path: string; size: number }[];
  deductions: { reason: string; points: number }[];
  recommendations: string[];
}

/**
 * Runs a deterministic health audit across scanned project images.
 * @param files Scanned files in the workspace
 * @returns DoctorReport containing health score, savings estimation, and recommendations
 */
export async function runDoctorAudit(files: ScannedFile[]): Promise<DoctorReport> {
  let healthScore = 100;
  let totalSize = 0;
  let potentialSavingsBytes = 0;
  const deductions: { reason: string; points: number }[] = [];
  const largestAssets: { path: string; size: number }[] = [];

  // Filter only input files to perform score calculations on,
  // since WebP/AVIF/SVG files are the optimized targets.
  const sourceImageExtensions = ['png', 'jpg', 'jpeg'];
  const sourceImages = files.filter(f => sourceImageExtensions.includes(f.extension));

  let metadataCount = 0;
  let missingAlternativesCount = 0;
  let over1MbCount = 0;
  let pngOver500KbCount = 0;

  for (const file of sourceImages) {
    let size = 0;
    try {
      const stats = await fs.stat(file.absolutePath);
      size = stats.size;
      totalSize += size;

      largestAssets.push({
        path: file.relativePath,
        size,
      });
    } catch {
      continue; // Skip files that can't be read
    }

    // 1. Deduct for files larger than 1MB (-5 points)
    if (size > 1024 * 1024) {
      over1MbCount++;
      healthScore -= 5;
      deductions.push({
        reason: `Image "${file.relativePath}" is larger than 1MB`,
        points: 5,
      });
    }

    // 2. Deduct for PNGs larger than 500KB (-2 points)
    if (file.extension === 'png' && size > 500 * 1024) {
      pngOver500KbCount++;
      healthScore -= 2;
      deductions.push({
        reason: `PNG image "${file.relativePath}" is larger than 500KB`,
        points: 2,
      });
    }

    // 3. Deduct for metadata presence (-3 points)
    let hasMetadata = false;
    try {
      const metadata = await sharp(file.absolutePath).metadata();
      // Metadata fields that we check for stripping
      if (metadata.exif || metadata.iptc || metadata.xmp || metadata.icc) {
        hasMetadata = true;
        metadataCount++;
        healthScore -= 3;
        deductions.push({
          reason: `Image "${file.relativePath}" contains embedded metadata`,
          points: 3,
        });
      }
    } catch {
      // Ignore image parsing errors during doctor checks
    }

    // 4. Deduct for missing WebP/AVIF optimized alternative version (-5 points)
    const fileDir = path.dirname(file.absolutePath);
    const baseName = path.basename(file.absolutePath, path.extname(file.absolutePath)).toLowerCase();
    
    const hasOptimizedVersion = files.some(f => {
      if (!['webp', 'avif'].includes(f.extension)) return false;
      const otherDir = path.dirname(f.absolutePath);
      const otherBaseName = path.basename(f.absolutePath, path.extname(f.absolutePath)).toLowerCase();
      
      // Check if it matches directory path and starts with the base name (supporting responsive suffixes like hero-640.webp)
      return fileDir === otherDir && (otherBaseName === baseName || otherBaseName.startsWith(`${baseName}-`));
    });

    if (!hasOptimizedVersion) {
      missingAlternativesCount++;
      healthScore -= 5;
      deductions.push({
        reason: `Image "${file.relativePath}" lacks optimized WebP or AVIF alternative`,
        points: 5,
      });
    }

    // Estimate potential savings (PNG: ~75%, JPEG/JPG: ~60%)
    if (file.extension === 'png') {
      potentialSavingsBytes += size * 0.75;
    } else {
      potentialSavingsBytes += size * 0.60;
    }
  }

  // Cap healthScore to minimum of 0
  healthScore = Math.max(0, healthScore);

  // Generate actionable recommendations
  const recommendations: string[] = [];
  if (missingAlternativesCount > 0) {
    const pngs = sourceImages.filter(f => f.extension === 'png').length;
    if (pngs > 0) {
      recommendations.push(`Convert ${pngs} PNG file(s) to WebP/AVIF to leverage modern formats.`);
    }
    const jpgs = sourceImages.filter(f => ['jpg', 'jpeg'].includes(f.extension)).length;
    if (jpgs > 0) {
      recommendations.push(`Optimize ${jpgs} JPEG/JPG file(s) to compress sizes.`);
    }
  }

  if (over1MbCount > 0) {
    recommendations.push(`Compress ${over1MbCount} image(s) larger than 1MB using lower quality presets or responsive scaling.`);
  }

  if (metadataCount > 0) {
    recommendations.push(`Remove embedded metadata from ${metadataCount} file(s) to strip unnecessary camera and color profiles.`);
  }

  // Sort largest assets list descending
  const sortedLargestAssets = largestAssets
    .sort((a, b) => b.size - a.size)
    .slice(0, 3);

  return {
    healthScore,
    totalSize,
    totalImages: sourceImages.length,
    potentialSavingsBytes: Math.round(potentialSavingsBytes),
    largestAssets: sortedLargestAssets,
    deductions,
    recommendations,
  };
}
