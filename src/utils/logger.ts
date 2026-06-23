import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import readline from 'node:readline';
import path from 'node:path';
import gradient from 'gradient-string';
import logUpdate from 'log-update';
import stringWidth from 'string-width';
import { formatSize, getReductionPercentage, type ReportSummary } from './metrics.js';
import type { OptimizationResult } from '../core/optimizer.js';
import type { FolderBreakdownItem } from '../core/doctor-engine.js';

let activeSpinner: Ora | null = null;
let animationsEnabled = true;

// Premium Gradient definition (Purple-Blue #5E6AD2 -> White)
const themeGradient = gradient(['#5E6AD2', '#FFFFFF']);

export function setAnimationsEnabled(enabled: boolean): void {
  animationsEnabled = enabled;
}

export function areAnimationsEnabled(): boolean {
  return animationsEnabled;
}

export function colorizeGradient(text: string): string {
  if (!animationsEnabled) return text;
  return themeGradient(text);
}

export function startSpinner(text: string): void {
  if (!animationsEnabled) {
    console.log(`  ${text}`);
    return;
  }
  if (activeSpinner) {
    activeSpinner.text = text;
  } else {
    activeSpinner = ora({
      text,
      color: 'cyan',
      spinner: 'dots',
    }).start();
  }
}

export function stopSpinner(success = true, text?: string): void {
  if (!animationsEnabled) {
    if (text) {
      console.log(`  ${success ? chalk.green('✓') : chalk.red('✗')} ${text}`);
    }
    return;
  }
  if (!activeSpinner) return;

  if (success) {
    activeSpinner.succeed(text);
  } else {
    activeSpinner.fail(text);
  }
  activeSpinner = null;
}

export function updateSpinner(text: string): void {
  if (!animationsEnabled) return;
  if (activeSpinner) {
    activeSpinner.text = text;
  }
}

/**
 * Renders the large responsive branding header with the #5E6AD2 to White gradient wordmark.
 */
export function renderBrandingHeader(): void {
  const logo = 'AssetFlow';
  const colorizedLogo = colorizeGradient(logo);

  console.log(`\n  ${chalk.bold(colorizedLogo)}`);
  console.log(`  ${chalk.white('Image Performance CLI')}`);
  console.log(`  ${chalk.gray('Install once. Never think about image optimization again.')}`);
  console.log(`  ${chalk.gray('────────────────────────────────────────────')}\n`);
}

/**
 * Renders the compact version of the header.
 */
export function renderCompactHeader(version = '1.0.0'): void {
  const brand = colorizeGradient('AssetFlow');
  console.log(`  ${chalk.bold(`${brand} v${version}`)}`);
  console.log(`  ${chalk.gray('────────────────────────────')}\n`);
}

/**
 * Premium Project Overview Dashboard Card
 */
export function printProjectCard(
  version: string,
  framework: string,
  imageCount: number,
  mode: string,
  generatedCount?: number,
  totalDetectedCount?: number,
  projectSize?: string,
  potentialSavings?: string,
  largestAssetPath?: string,
  largestAssetSize?: string
): void {
  const brand = colorizeGradient(`AssetFlow v${version}`);
  console.log(`  ${brand}\n`);
  console.log(`  ${chalk.gray('Project'.padEnd(16))} ${chalk.white(framework)}`);
  console.log(`  ${chalk.gray('Images'.padEnd(16))} ${chalk.white(imageCount.toString())}`);
  if (projectSize) {
    console.log(`  ${chalk.gray('Project Size'.padEnd(16))} ${chalk.white(projectSize)}`);
  }
  if (potentialSavings) {
    console.log(`  ${chalk.gray('Potential Save'.padEnd(16))} ${chalk.green(potentialSavings)}`);
  }
  console.log(`  ${chalk.gray('Mode'.padEnd(16))} ${chalk.white(mode)}`);
  console.log(`  ${chalk.gray('────────────────────────────')}\n`);
}

/**
 * Claude-Style Thinking Timeline
 */
export async function playThinkingTimeline(data: {
  framework: string;
  imagesCount: number;
  savings: string;
  score: number;
  recsCount: number;
}): Promise<void> {
  const steps = [
    { label: 'Detecting framework', done: `${data.framework} project detected` },
    { label: 'Scanning images', done: `${data.imagesCount} images found` },
    { label: 'Analyzing optimization opportunities', done: `${data.savings} potential savings` },
    { label: 'Evaluating project health', done: `Score: ${data.score}/100` },
    { label: 'Generating recommendations', done: `${data.recsCount} recommendations generated` }
  ];

  if (!animationsEnabled) {
    // Static instant layout print
    for (const step of steps) {
      console.log(`  ${chalk.green('✓')} ${chalk.white(step.done)}`);
    }
    console.log(`\n  ${chalk.bold.green('Audit Complete')}\n`);
    return;
  }

  for (let i = 0; i < steps.length; i++) {
    // Smooth 2-frame tick spinner
    for (let frame = 0; frame < 2; frame++) {
      const spinner = frame === 0 ? '◉' : '○';
      let output = '';
      for (let j = 0; j < steps.length; j++) {
        if (j < i) {
          output += `  ${chalk.green('✓')} ${chalk.gray(steps[j].done)}\n`;
        } else if (j === i) {
          output += `  ${chalk.cyan(spinner)} ${chalk.bold(steps[j].label)}\n`;
        } else {
          output += `  ${chalk.gray('○')} ${chalk.gray(steps[j].label)}\n`;
        }
      }
      logUpdate(output);
      await new Promise(resolve => setTimeout(resolve, 80));
    }

    // Complete current step
    let output = '';
    for (let j = 0; j <= i; j++) {
      output += `  ${chalk.green('✓')} ${chalk.gray(steps[j].done)}\n`;
    }
    for (let j = i + 1; j < steps.length; j++) {
      output += `  ${chalk.gray('○')} ${chalk.gray(steps[j].label)}\n`;
    }
    logUpdate(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // End timeline
  let finalOutput = '';
  for (const step of steps) {
    finalOutput += `  ${chalk.green('✓')} ${chalk.white(step.done)}\n`;
  }
  finalOutput += `\n  ${chalk.bold.green('Audit Complete')}\n`;
  logUpdate(finalOutput);
  logUpdate.done();
}

/**
 * Animated Progress System
 */
export function updateProgress(completed: number, total: number, currentFile: string, startTime: number): void {
  const percent = Math.round((completed / total) * 100);
  const barWidth = 20;
  const filledWidth = Math.round((completed / total) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);

  const elapsedMs = Date.now() - startTime;
  const speed = completed > 0 ? (completed / (elapsedMs / 1000)) : 0;
  const eta = speed > 0 ? Math.round((total - completed) / speed) : 0;

  if (!animationsEnabled) {
    // If animations are off, we don't spam output in progress logs
    return;
  }

  const cleanFile = path.basename(currentFile);
  const shortFile = stringWidth(cleanFile) > 40 ? cleanFile.slice(0, 37) + '...' : cleanFile;

  let output = `  ${chalk.bold('Optimizing Assets')}\n`;
  output += `  ${chalk.cyan(bar)}  ${chalk.bold(completed)} / ${chalk.bold(total)} (${percent}%)\n\n`;
  output += `  ${chalk.gray('Current File')}  ${chalk.white(shortFile || 'Preparing...')}\n`;
  output += `  ${chalk.gray('Speed       ')}  ${chalk.white(speed.toFixed(1) + ' img/s')}\n`;
  output += `  ${chalk.gray('ETA         ')}  ${chalk.white(eta + 's')}\n`;

  logUpdate(output);
}

export function completeProgress(total: number): void {
  if (!animationsEnabled) {
    console.log(`  ${chalk.green('✓')} Optimization complete across ${total} images.`);
    return;
  }
  logUpdate.clear();
  logUpdate.done();
}

/**
 * Helper to fetch scoring letter grades
 */
function getHealthGrade(score: number): { grade: string; color: (s: string) => string; desc: string } {
  if (score >= 95) return { grade: 'Grade A+', color: chalk.green.bold, desc: 'Excellent Optimization Hygiene' };
  if (score >= 90) return { grade: 'Grade A', color: chalk.green.bold, desc: 'Great Optimization, very fast' };
  if (score >= 80) return { grade: 'Grade B+', color: chalk.cyan.bold, desc: 'Good performance, minor adjustments needed' };
  if (score >= 70) return { grade: 'Grade B', color: chalk.yellow.bold, desc: 'Fair, some opportunities remain' };
  if (score >= 50) return { grade: 'Grade C', color: chalk.yellow.bold, desc: 'Needs compression & format conversion' };
  return { grade: 'Grade D', color: chalk.red.bold, desc: 'Critical image size bloating detected' };
}

/**
 * Renders Positive Health Score Breakdown Dashboard
 */
export function printPremiumHealthScore(score: number, breakdown?: any): void {
  const { grade, color, desc } = getHealthGrade(score);
  const barWidth = 20;
  const filled = Math.round((score / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

  console.log(`  ${chalk.bold('Health Score')}`);
  console.log(`  ${bar}  ${color(score + '/100')} (${chalk.bold(grade)})\n`);
  console.log(`  ${chalk.gray('Status:')} ${chalk.white(desc)}\n`);

  if (breakdown) {
    console.log(`  ${chalk.bold('Breakdown')}`);
    console.log(`  ${chalk.gray('Size Efficiency     ')} ${chalk.white(breakdown.sizeEfficiency + '/100')}`);
    console.log(`  ${chalk.gray('Modern Formats      ')} ${chalk.white(breakdown.modernFormats + '/100')}`);
    console.log(`  ${chalk.gray('Metadata Hygiene    ')} ${chalk.white(breakdown.metadataHygiene + '/100')}`);
    console.log(`  ${chalk.gray('Asset Optimization  ')} ${chalk.white(breakdown.assetOptimization + '/100')}`);
    console.log(`  ${chalk.gray('────────────────────')}`);
    console.log(`  ${chalk.gray('Final Score         ')} ${color(score + '/100')}\n`);
  }
}

/**
 * Before vs After visual size comparisons
 */
export function printSizeComparison(original: number, optimized: number): void {
  const maxBarWidth = 20;
  const originalBar = chalk.red('█'.repeat(maxBarWidth));
  const optimizedBarWidth = original > 0 ? Math.round((optimized / original) * maxBarWidth) : 0;
  const optimizedBar = chalk.green('█'.repeat(optimizedBarWidth)) + chalk.gray('░'.repeat(maxBarWidth - optimizedBarWidth));

  const spaceSaved = Math.max(0, original - optimized);
  const reduction = original > 0 ? Math.round((spaceSaved / original) * 100) : 0;

  console.log(`  ${chalk.bold('Before / After Size Comparison')}\n`);
  console.log(`  ${chalk.gray('Before')}  ${originalBar}  ${chalk.red(formatSize(original).padStart(8))}`);
  console.log(`  ${chalk.gray('After ')}  ${optimizedBar}  ${chalk.green(formatSize(optimized).padStart(8))}\n`);
  console.log(`  ${chalk.gray('Saved ')}  ${chalk.bold.green(formatSize(spaceSaved))} (${reduction}% reduction)\n`);
}

/**
 * Visual Largest Assets horizontal bars
 */
export function printLargestAssetsVisual(assets: { path: string; size: number }[]): void {
  console.log(`  ${chalk.bold('Largest Assets')}\n`);
  if (assets.length === 0) {
    console.log(`    ${chalk.gray('No source PNG, JPG, or JPEG files found.')}`);
    return;
  }

  const maxSize = Math.max(...assets.map(a => a.size), 1);
  const maxBarWidth = 20;

  assets.slice(0, 5).forEach((asset) => {
    const barWidth = Math.round((asset.size / maxSize) * maxBarWidth);
    const bar = chalk.yellow('█'.repeat(barWidth)) + chalk.gray('░'.repeat(maxBarWidth - barWidth));

    let displayPath = asset.path;
    if (stringWidth(displayPath) > 38) {
      displayPath = '...' + displayPath.slice(-35);
    }
    const pathCol = displayPath.padEnd(40);
    console.log(`  ${chalk.white(pathCol)} ${bar}  ${chalk.yellow(formatSize(asset.size))}`);
  });
  console.log('');
}

/**
 * Visual Savings Opportunities horizontal bars
 */
export function printSavingsOpportunitiesVisual(opportunities: { path: string; size: number; savings: number }[]): void {
  console.log(`  ${chalk.bold('Top Savings Opportunities')}\n`);
  if (opportunities.length === 0) {
    console.log(`    ${chalk.gray('No savings opportunities detected.')}`);
    return;
  }

  const maxSavings = Math.max(...opportunities.map(o => o.savings), 1);
  const maxBarWidth = 20;

  opportunities.slice(0, 5).forEach((opp) => {
    const barWidth = Math.round((opp.savings / maxSavings) * maxBarWidth);
    const bar = chalk.green('█'.repeat(barWidth)) + chalk.gray('░'.repeat(maxBarWidth - barWidth));

    let displayPath = opp.path;
    if (stringWidth(displayPath) > 38) {
      displayPath = '...' + displayPath.slice(-35);
    }
    const pathCol = displayPath.padEnd(40);
    console.log(`  ${chalk.white(pathCol)} ${bar}  ${chalk.green(formatSize(opp.savings))}`);
  });
  console.log('');
}

/**
 * Renders visual breakdown tables for folders
 */
export function printFolderBreakdownTable(folders: FolderBreakdownItem[]): void {
  console.log(`  ${chalk.bold('Folder Performance Breakdown')}\n`);
  if (folders.length === 0) {
    console.log(`    ${chalk.gray('No folder breakdown data available.')}`);
    return;
  }

  console.log(`  ${chalk.gray('Folder'.padEnd(20))} ${chalk.gray('Files'.padStart(6))} ${chalk.gray('Size'.padStart(10))}   ${chalk.gray('Savings')}`);

  const maxSavings = Math.max(...folders.map(f => f.estimatedSavings), 1);
  const barWidth = 10;

  folders.forEach((item) => {
    let folderName = item.folder;
    if (stringWidth(folderName) > 20) {
      folderName = folderName.slice(0, 17) + '...';
    }
    const folderCol = folderName.padEnd(20);
    const filesCol = item.fileCount.toString().padStart(6);
    const sizeCol = formatSize(item.totalSize).padStart(10);

    const filled = Math.round((item.estimatedSavings / maxSavings) * barWidth);
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barWidth - filled));
    const savingsText = formatSize(item.estimatedSavings);

    console.log(`  ${chalk.white(folderCol)} ${chalk.white(filesCol)} ${chalk.white(sizeCol)}   ${bar} ${chalk.green(savingsText)}`);
  });
  console.log('');
}

/**
 * Report folder-level savings table
 */
export function printFolderSavingsTable(folders: { folder: string; count: number; original: number; optimized: number }[]): void {
  console.log(`  ${chalk.bold('Folder-Level Savings Breakdown')}\n`);
  if (folders.length === 0) {
    console.log(`    ${chalk.gray('No folder breakdown data available.')}`);
    return;
  }

  console.log(`  ${chalk.gray('Folder'.padEnd(20))} ${chalk.gray('Files'.padStart(6))} ${chalk.gray('Before'.padStart(10))} ${chalk.gray('After'.padStart(10))}   ${chalk.gray('Saved')}`);

  folders.forEach((item) => {
    let folderName = item.folder;
    if (stringWidth(folderName) > 20) {
      folderName = folderName.slice(0, 17) + '...';
    }
    const folderCol = folderName.padEnd(20);
    const filesCol = item.count.toString().padStart(6);
    const originalCol = formatSize(item.original).padStart(10);
    const optimizedCol = formatSize(item.optimized).padStart(10);
    const savedBytes = Math.max(0, item.original - item.optimized);
    const savedCol = formatSize(savedBytes);

    console.log(`  ${chalk.white(folderCol)} ${chalk.white(filesCol)} ${chalk.white(originalCol)} ${chalk.white(optimizedCol)}   ${chalk.green(savedCol)}`);
  });
  console.log('');
}

/**
 * Log individual file optimization outcome in watch mode
 */
export function logWatchOptimization(res: OptimizationResult): void {
  if (!res.success) {
    console.log(`  ${chalk.red('✗')} ${chalk.gray(res.relativePath)} — ${chalk.red(res.error || 'Failed')}`);
    return;
  }
  if (res.skipped) {
    console.log(`  ${chalk.cyan('✓')} ${chalk.gray(res.relativePath)} optimized`);
    return;
  }
  if (res.optimizedFiles.length === 0) {
    return;
  }
  const formats = res.optimizedFiles.map(o => o.format.toUpperCase()).join('/');
  console.log(`  ${chalk.green('✓')} ${chalk.white(res.relativePath)} optimized to ${chalk.green(formats)}`);
}

/**
 * Graded impact recommendations dashboard card
 */
export function printRankedRecommendations(recommendations: string[], audit: any): void {
  console.log(`  ${chalk.bold('Recommendations')}\n`);

  if (recommendations.length === 0 && audit.healthScore === 100) {
    console.log(`  ${chalk.green('✓')} All images fully optimized! Keep up the good work.\n`);
    return;
  }

  const categorized: { impact: 'High' | 'Medium' | 'Low'; text: string; savings: string; color: (s: string) => string }[] = [];

  if (audit.potentialSavingsBytes >= 5 * 1024 * 1024) {
    categorized.push({
      impact: 'High',
      color: chalk.red.bold,
      text: 'Convert source PNG/JPG images to WebP/AVIF to leverage modern compression formats',
      savings: formatSize(audit.potentialSavingsBytes)
    });
  } else if (audit.potentialSavingsBytes > 0) {
    categorized.push({
      impact: 'Medium',
      color: chalk.yellow.bold,
      text: 'Convert remaining source PNG/JPG images to WebP/AVIF',
      savings: formatSize(audit.potentialSavingsBytes)
    });
  }

  const over1MbCount = audit.deductions.filter((d: any) => d.reason.includes('larger than 1MB')).length;
  if (over1MbCount > 0) {
    const sizeSavings = over1MbCount * 800 * 1024;
    categorized.push({
      impact: over1MbCount > 5 ? 'High' : 'Medium',
      color: over1MbCount > 5 ? chalk.red.bold : chalk.yellow.bold,
      text: `Compress ${over1MbCount} oversized image(s) > 1MB using lower quality presets or scaling`,
      savings: formatSize(sizeSavings)
    });
  }

  const metadataCount = audit.deductions.filter((d: any) => d.reason.includes('embedded metadata')).length;
  if (metadataCount > 0) {
    const metadataSavings = metadataCount * 15 * 1024;
    categorized.push({
      impact: 'Low',
      color: chalk.cyan.bold,
      text: `Remove camera profile EXIF/ICC metadata from ${metadataCount} image(s)`,
      savings: formatSize(metadataSavings)
    });
  }

  const order = { High: 0, Medium: 1, Low: 2 };
  categorized.sort((a, b) => order[a.impact] - order[b.impact]);

  categorized.forEach((rec) => {
    console.log(`  ${rec.color(rec.impact + ' Impact')}`);
    console.log(`  ${chalk.white(rec.text)}`);
    console.log(`  ${chalk.gray('Potential Savings')}  ${chalk.green.bold(rec.savings)}`);
    console.log(`  ${chalk.gray('────────────────────────────────────')}`);
  });
  console.log('');
}

/**
 * Satisfying Completion Screen card
 */
export function printCompletionCard(summary: ReportSummary, healthBefore: number, healthAfter: number): void {
  const border = chalk.gray('────────────────────────────────────');
  console.log(`\n  ${border}`);
  console.log(`  ${chalk.bold('Optimization Complete')}\n`);

  console.log(`  ${chalk.gray('Source Images').padEnd(20)} ${chalk.white(summary.sourceImages.toString().padStart(6))}`);
  console.log(`  ${chalk.gray('Optimized').padEnd(20)} ${chalk.white(summary.optimizedCount.toString().padStart(6))}`);
  console.log(`  ${chalk.gray('Cache Hits').padEnd(20)} ${chalk.white(summary.cacheSkippedCount.toString().padStart(6))}`);
  console.log(`  ${chalk.gray('Errors').padEnd(20)} ${chalk.white(summary.errorCount.toString().padStart(6))}`);
  console.log('');
  console.log(`  ${chalk.gray('Space Saved').padEnd(20)} ${chalk.green.bold(formatSize(summary.spaceSaved).padStart(6))}`);
  console.log(`  ${chalk.gray('Reduction').padEnd(20)} ${chalk.green(Math.round(summary.averageReduction).toString().concat('%').padStart(6))}`);

  if (healthBefore !== healthAfter) {
    console.log('');
    console.log(`  ${chalk.gray('Health Score').padEnd(20)} ${chalk.cyan(`${healthBefore} → ${healthAfter}`.padStart(6))}`);
  }

  console.log(`  ${chalk.gray('Execution Time').padEnd(20)} ${chalk.white(((summary.executionTimeMs / 1000).toFixed(2) + 's').padStart(6))}`);
  console.log(`  ${border}\n`);
}

/**
 * Simple optimization print details
 */
export function logFileOptimization(res: OptimizationResult): void {
  if (!res.success) {
    console.log(`  ${chalk.red('✗')} ${chalk.gray(res.relativePath)} — ${chalk.red(res.error || 'Failed')}`);
    return;
  }
  if (res.skipped) {
    console.log(`  ${chalk.cyan('✓')} ${chalk.gray(res.relativePath)} — skipped (unchanged)`);
    return;
  }
  for (const opt of res.optimizedFiles) {
    const sizeLabel = opt.width ? ` (${opt.width}px)` : '';
    const reduction = getReductionPercentage(res.originalSize, opt.size);
    const reductionText = reduction > 0 ? ` (${reduction}% reduction)` : '';
    console.log(
      `  ${chalk.green('✓')} ${chalk.white(res.relativePath)}${chalk.cyan(sizeLabel)} → ${chalk.green(opt.format.toUpperCase())} ${chalk.gray(formatSize(res.originalSize))} → ${chalk.white(formatSize(opt.size))}${chalk.green(reductionText)}`
    );
  }
}

export function printSuccess(text: string): void {
  console.log(`  ${chalk.green.bold('✓')} ${text}`);
}

export function printWarning(text: string): void {
  console.log(`  ${chalk.yellow.bold('⚠️')} ${chalk.yellow(text)}`);
}

export function printError(text: string): void {
  console.log(`  ${chalk.red.bold('Error:')} ${chalk.red(text)}`);
}
