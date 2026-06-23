import fs from 'node:fs/promises';
import path from 'node:path';
import type { OptimizationResult } from '../core/optimizer.js';
import { getReductionPercentage } from './metrics.js';

export interface ReportFileItem {
  filePath: string;
  originalSize: number;
  optimizedSize: number;
  reductionPercentage: number;
  success: boolean;
  error: string | null;
  outputs: {
    path: string;
    size: number;
    format: string;
    width: number | null;
    height: number | null;
  }[];
}

export interface ReportJsonData {
  timestamp: string;
  summary: {
    totalOriginalImages: number;
    totalOriginalSize: number;
    totalOptimizedSize: number;
    spaceSaved: number;
    averageReduction: number;
  };
  files: ReportFileItem[];
  warnings: string[];
  recommendations: string[];
  healthScore: number | null;
}

/**
 * Saves a detailed run report to assetflow-report.json in the project root.
 * @param projectRoot Base directory of the project
 * @param results File optimization results
 * @param healthScore Determined health score (optional)
 * @param recommendations Custom tips generated (optional)
 */
export async function exportReportJson(
  projectRoot: string,
  results: OptimizationResult[],
  healthScore: number | null = null,
  recommendations: string[] = []
): Promise<string> {
  const filePath = path.join(projectRoot, 'assetflow-report.json');

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let totalOriginalImages = 0;

  const filesList: ReportFileItem[] = results.map((res) => {
    totalOriginalImages++;
    totalOriginalSize += res.originalSize;

    let imageOutputSize = 0;
    const outputs = res.optimizedFiles.map((opt) => {
      imageOutputSize += opt.size;
      return {
        path: opt.relativePath,
        size: opt.size,
        format: opt.format,
        width: opt.width,
        height: opt.height,
      };
    });

    totalOptimizedSize += res.success ? imageOutputSize : res.originalSize;

    return {
      filePath: res.relativePath,
      originalSize: res.originalSize,
      optimizedSize: res.success ? imageOutputSize : res.originalSize,
      reductionPercentage: res.success ? getReductionPercentage(res.originalSize, imageOutputSize) : 0,
      success: res.success,
      error: res.error,
      outputs,
    };
  });

  const spaceSaved = Math.max(0, totalOriginalSize - totalOptimizedSize);
  const averageReduction = totalOriginalSize > 0
    ? (spaceSaved / totalOriginalSize) * 100
    : 0;

  const warnings: string[] = [];
  for (const res of results) {
    if (!res.success && res.error) {
      warnings.push(`File ${res.relativePath} failed: ${res.error}`);
    }
  }

  const reportData: ReportJsonData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalOriginalImages,
      totalOriginalSize,
      totalOptimizedSize,
      spaceSaved,
      averageReduction: Math.round(averageReduction),
    },
    files: filesList,
    warnings,
    recommendations,
    healthScore,
  };

  await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf8');
  return filePath;
}
