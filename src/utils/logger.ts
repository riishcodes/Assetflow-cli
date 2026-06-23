import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { formatSize, getReductionPercentage, type ReportSummary } from './metrics.js';
import type { OptimizationResult } from '../core/optimizer.js';

let activeSpinner: Ora | null = null;

export function startSpinner(text: string): void {
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
  if (!activeSpinner) return;

  if (success) {
    activeSpinner.succeed(text);
  } else {
    activeSpinner.fail(text);
  }
  activeSpinner = null;
}

export function updateSpinner(text: string): void {
  if (activeSpinner) {
    activeSpinner.text = text;
  }
}

/**
 * Log individual file optimization outcome.
 */
export function logFileOptimization(res: OptimizationResult): void {
  if (!res.success) {
    console.log(
      `  ${chalk.red('✗')} ${chalk.gray(res.relativePath)} — ${chalk.red(res.error || 'Failed')}`
    );
    return;
  }

  // Iterate and show all generated formats / sizes for this image
  for (const opt of res.optimizedFiles) {
    const sizeLabel = opt.width ? ` (${opt.width}px)` : '';
    const reduction = getReductionPercentage(res.originalSize, opt.size);
    const reductionText = reduction > 0 ? ` (${reduction}% reduction)` : '';

    console.log(
      `  ${chalk.green('✓')} ${chalk.bold(res.relativePath)}${chalk.cyan(sizeLabel)} ${chalk.yellow('→')} ${chalk.bold(opt.format.toUpperCase())}`
    );
    console.log(
      `    ${chalk.gray(formatSize(res.originalSize))} ${chalk.gray('→')} ${chalk.white(formatSize(opt.size))}${chalk.green(reductionText)}`
    );
  }
}

/**
 * Renders a premium, Vercel-like terminal summary card.
 */
export function printSummaryCard(summary: ReportSummary): void {
  console.log('\n' + chalk.cyan('  ┌────────────────────────────────────────────────────────┐'));
  console.log(`  │  ${chalk.bold.cyan('AssetFlow CLI — Optimization Summary')}                  │`);
  console.log('  ├────────────────────────────────────────────────────────┤');
  console.log(`  │  Processed Images:   ${chalk.white(summary.totalImages.toString().padEnd(34))} │`);
  console.log(`  │  Original Size:      ${chalk.white(formatSize(summary.originalSize).padEnd(34))} │`);
  console.log(`  │  Optimized Size:     ${chalk.white(formatSize(summary.optimizedSize).padEnd(34))} │`);
  console.log(`  │  Saved Space:        ${chalk.green.bold(formatSize(summary.spaceSaved).padEnd(34))} │`);
  console.log(`  │  Average Reduction:  ${chalk.green(Math.round(summary.averageReduction).toString().concat('%').padEnd(34))} │`);
  console.log(`  │  Execution Time:     ${chalk.white(((summary.executionTimeMs / 1000).toFixed(2) + 's').padEnd(34))} │`);
  
  if (summary.failedFiles.length > 0) {
    console.log('  ├────────────────────────────────────────────────────────┤');
    console.log(`  │  ${chalk.red.bold('Failed Files:')}      ${chalk.red(summary.failedFiles.length.toString().padEnd(34))} │`);
  }

  console.log('  └────────────────────────────────────────────────────────┘\n');
}

/**
 * Prints generic success status.
 */
export function printSuccess(text: string): void {
  console.log(`  ${chalk.green.bold('✓')} ${text}`);
}

/**
 * Prints generic warning message.
 */
export function printWarning(text: string): void {
  console.log(`  ${chalk.yellow.bold('⚠️')} ${chalk.yellow(text)}`);
}

/**
 * Prints generic error message.
 */
export function printError(text: string): void {
  console.log(`  ${chalk.red.bold('Error:')} ${chalk.red(text)}`);
}
