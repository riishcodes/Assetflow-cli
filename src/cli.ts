import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadConfig, mergeConfig } from './config/manager.js';
import { scanDirectories, type ScannedFile } from './core/scanner.js';
import { optimizeImage, type OptimizationResult } from './core/optimizer.js';
import { runDoctorAudit } from './core/doctor-engine.js';
import { readCache, writeCache, compareCache } from './core/cache-manager.js';
import { getChangedFiles } from './core/changed.js';
import { startWatcher } from './core/watch.js';
import { exportReportJson } from './utils/report-exporter.js';
import { compileSummary, formatSize } from './utils/metrics.js';
import * as logger from './utils/logger.js';
import chalk from 'chalk';

// Helper for parallel task limiting
async function processInParallel<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const executing: Promise<any>[] = [];

  for (let i = 0; i < items.length; i++) {
    const p = Promise.resolve()
      .then(() => fn(items[i]))
      .then(res => {
        results[i] = res;
        executing.splice(executing.indexOf(p), 1);
      });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// Utility to retrieve version from package.json
async function getPackageVersion(projectRoot: string): Promise<string> {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export async function runCli(argv: string[], projectRoot: string): Promise<void> {
  const program = new Command();
  const version = await getPackageVersion(projectRoot);

  program
    .name('assetflow')
    .description('Install once. Never think about image optimization again.')
    .version(version);

  // Global command configuration options
  program
    .option('-d, --dry-run', 'Scan and estimate savings without modifying files')
    .option('-c, --changed', 'Optimize only files modified/staged/untracked in Git')
    .option('--config <path>', 'Specify custom path to config file')
    .option('-f, --format <webp|avif|both>', 'Output formats WebP, AVIF or both')
    .option('-q, --quality <number>', 'Override target compression quality (1-100)', (val) => parseInt(val, 10))
    .option('-p, --preset <balanced|quality|compression>', 'Compression presets')
    .option('--force', 'Force reprocessing of all files, ignoring cached checksum hashes');

  // Default optimize action
  program
    .action(async (options) => {
      await handleOptimizeCommand(projectRoot, options);
    });

  // Optimize command (alias to default command)
  program
    .command('optimize')
    .description('Discover and optimize image assets in the project')
    .action(async () => {
      // CLI options are parsed globally, pass global options to handler
      await handleOptimizeCommand(projectRoot, program.opts());
    });

  // Watch command
  program
    .command('watch')
    .description('Watch image folders and auto-optimize files as they change')
    .action(async () => {
      await handleWatchCommand(projectRoot, program.opts());
    });

  // Doctor command
  program
    .command('doctor')
    .description('Audit project image assets for optimization opportunities and calculate score')
    .action(async () => {
      await handleDoctorCommand(projectRoot);
    });

  // Report command
  program
    .command('report')
    .description('Display summary metrics and historical improvement comparison details')
    .action(async () => {
      await handleReportCommand(projectRoot);
    });

  await program.parseAsync(argv);
}

/**
 * Handles the "optimize" command flow.
 */
async function handleOptimizeCommand(projectRoot: string, options: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.startSpinner('Loading configuration...');
    const fileConfig = await loadConfig(projectRoot);
    const config = mergeConfig(fileConfig, options);
    logger.stopSpinner(true, 'Configuration loaded');

    let files: ScannedFile[] = [];

    if (options.changed) {
      logger.startSpinner('Scanning git repository for changes...');
      const changedFilesList = await getChangedFiles(projectRoot);
      
      if (changedFilesList === null) {
        logger.stopSpinner(false, 'Not in a Git repository. Falling back to full directory scan.');
        files = await scanDirectories(projectRoot, config);
      } else {
        logger.stopSpinner(true, `Found ${changedFilesList.length} changed path(s) in Git`);
        
        // Filter changed files to only scan paths inside our configured folders, ignoring excluded ones
        const allScanned = await scanDirectories(projectRoot, config);
        files = allScanned.filter(f => changedFilesList.includes(f.relativePath));
      }
    } else {
      logger.startSpinner('Scanning image directories...');
      files = await scanDirectories(projectRoot, config);
      logger.stopSpinner(true, `Scan complete. Found ${files.length} candidate image(s)`);
    }

    // Filter list to only process source PNG, JPG, JPEG files
    const sourceImages = files.filter(f => ['png', 'jpg', 'jpeg'].includes(f.extension));

    if (sourceImages.length === 0) {
      logger.printWarning('No unoptimized PNG, JPG, or JPEG images found to process.');
      return;
    }

    const previousCache = await readCache(projectRoot);
    const cachedHashes = previousCache?.hashes || {};

    console.log(`\n  ${chalk.cyan('Optimizing assets in parallel (limit: 4)...')}\n`);

    let completed = 0;
    logger.startSpinner(`Optimizing ${completed}/${sourceImages.length} images...`);

    const processedResults = await processInParallel(sourceImages, 4, async (file) => {
      const result = await optimizeImage(file, config, projectRoot, {
        dryRun: !!options.dryRun,
        cachedHash: cachedHashes[file.relativePath]
      });
      completed++;
      logger.updateSpinner(`Optimizing ${completed}/${sourceImages.length} images...`);
      return result;
    });

    logger.stopSpinner(true, 'Optimization finished');

    // Sequentially print rows to terminal for DX visual elegance
    let skippedCount = 0;
    for (const result of processedResults) {
      if (result.skipped) {
        skippedCount++;
        console.log(`  ${chalk.cyan('✓')} ${chalk.gray(result.relativePath)} — ${chalk.cyan('skipped (unchanged)')}`);
      } else {
        logger.logFileOptimization(result);
      }
    }

    if (skippedCount > 0) {
      console.log(`\n  ${chalk.cyan('i')} Skipped ${skippedCount} file(s) because they were already optimized (hashes matched).`);
    }

    const executionTimeMs = Date.now() - startTime;
    const summary = compileSummary(processedResults, executionTimeMs);
    logger.printSummaryCard(summary);

    // Run audit to get health score and recommendations for final report
    logger.startSpinner('Compiling report data...');
    // Scan again to catch newly written files if not dryRun
    const finalScan = await scanDirectories(projectRoot, config);
    const audit = await runDoctorAudit(finalScan);

    // Save report to JSON file
    const reportPath = await exportReportJson(
      projectRoot,
      processedResults,
      audit.healthScore,
      audit.recommendations
    );
    logger.stopSpinner(true, `Report saved to: ${chalk.gray(path.basename(reportPath))}`);

    // If not a dry run, update history fingerprint in .assetflow/cache.json
    if (!options.dryRun) {
      const newHashes: Record<string, string> = { ...cachedHashes };
      for (const res of processedResults) {
        if (res.success && res.hash) {
          newHashes[res.relativePath] = res.hash;
        }
      }

      await writeCache(projectRoot, {
        images: audit.totalImages,
        totalSize: formatSize(audit.totalSize),
        totalSizeBytes: audit.totalSize,
        healthScore: audit.healthScore,
        hashes: newHashes,
      });
    }
  } catch (error: any) {
    logger.stopSpinner(false, 'Execution aborted');
    logger.printError(error.message || String(error));
    process.exit(1);
  }
}

/**
 * Handles the "watch" command flow.
 */
async function handleWatchCommand(projectRoot: string, options: any): Promise<void> {
  try {
    const fileConfig = await loadConfig(projectRoot);
    const config = mergeConfig(fileConfig, options);

    console.log(`\n  ${chalk.cyan.bold('AssetFlow Watcher')}`);
    console.log(`  Watching: ${chalk.gray(config.directories?.join(', ') || 'src, public, assets, images')}`);
    console.log(`  Output Formats: ${chalk.white(config.format.toUpperCase())}`);
    console.log(`  Target Quality: ${chalk.white(config.quality.toString())}`);
    console.log(`  Press ${chalk.bold('Ctrl+C')} to exit.\n`);

    startWatcher(projectRoot, config, async (result) => {
      logger.logFileOptimization(result);

      // Re-run report compilation in background on change
      try {
        const finalScan = await scanDirectories(projectRoot, config);
        const audit = await runDoctorAudit(finalScan);
        await exportReportJson(projectRoot, [result], audit.healthScore, audit.recommendations);

        const previousCache = await readCache(projectRoot);
        const newHashes = previousCache ? { ...previousCache.hashes } : {};
        if (result.success && result.hash) {
          newHashes[result.relativePath] = result.hash;
        }

        await writeCache(projectRoot, {
          images: audit.totalImages,
          totalSize: formatSize(audit.totalSize),
          totalSizeBytes: audit.totalSize,
          healthScore: audit.healthScore,
          hashes: newHashes,
        });
      } catch {
        // Ignore background reporting errors
      }
    });
  } catch (error: any) {
    logger.printError(error.message || String(error));
    process.exit(1);
  }
}

/**
 * Handles the "doctor" command flow.
 */
async function handleDoctorCommand(projectRoot: string): Promise<void> {
  try {
    logger.startSpinner('Analyzing project image health...');
    const config = await loadConfig(projectRoot);
    const files = await scanDirectories(projectRoot, config);
    const audit = await runDoctorAudit(files);
    const previousCache = await readCache(projectRoot);
    logger.stopSpinner(true, 'Audit check finished');

    console.log(`\n  ${chalk.cyan.bold('Project Image Audit')}`);
    console.log(`  ────────────────────────────────────────────────────────\n`);

    // Render Health Score and comparison
    const scoreColor = audit.healthScore >= 90
      ? chalk.green
      : audit.healthScore >= 70
        ? chalk.yellow
        : chalk.red;

    console.log(`  ${chalk.bold('Project Health Score:')}    ${scoreColor.bold(audit.healthScore)} / 100`);

    if (previousCache) {
      const delta = compareCache(audit.healthScore, audit.totalSize, audit.totalImages, previousCache);
      if (delta.scoreImprovement !== null) {
        const sign = delta.scoreImprovement >= 0 ? '+' : '';
        const impColor = delta.scoreImprovement >= 0 ? chalk.green : chalk.red;
        console.log(`  ${chalk.gray(`(Previous Score: ${delta.previousScore} | Improvement: ${impColor(sign + delta.scoreImprovement)})`)}`);
      }
    }

    console.log(`  ${chalk.bold('Potential Savings:')}       ${chalk.green.bold(formatSize(audit.potentialSavingsBytes))}`);
    console.log(`  ${chalk.bold('Scanned Images:')}          ${chalk.white(audit.totalImages.toString())}`);
    console.log(`  ${chalk.bold('Total File Size:')}         ${chalk.white(formatSize(audit.totalSize))}`);

    // Render Largest Assets section
    console.log(`\n  ${chalk.cyan.bold('Largest Assets:')}`);
    if (audit.largestAssets.length === 0) {
      console.log(`    ${chalk.gray('No source PNG, JPG, or JPEG files found.')}`);
    } else {
      audit.largestAssets.forEach((asset, idx) => {
        console.log(`    ${idx + 1}. ${chalk.white(asset.path)} — ${chalk.yellow(formatSize(asset.size))}`);
      });
    }

    // Render recommendations
    console.log(`\n  ${chalk.cyan.bold('Recommendations:')}`);
    if (audit.recommendations.length === 0 && audit.healthScore === 100) {
      console.log(`    ${chalk.green('✓')} All images fully optimized! Keep up the good work.`);
    } else {
      audit.recommendations.forEach((rec) => {
        console.log(`    ${chalk.yellow('•')} ${rec}`);
      });
    }

    console.log('');
  } catch (error: any) {
    logger.printError(error.message || String(error));
    process.exit(1);
  }
}

/**
 * Handles the "report" command flow.
 */
async function handleReportCommand(projectRoot: string): Promise<void> {
  const reportPath = path.join(projectRoot, 'assetflow-report.json');

  try {
    const rawReport = await fs.readFile(reportPath, 'utf8');
    const reportData = JSON.parse(rawReport);
    const previousCache = await readCache(projectRoot);

    console.log(`\n  ${chalk.cyan.bold('Last Optimization Report')}`);
    console.log(`  Generated at: ${chalk.gray(new Date(reportData.timestamp).toLocaleString())}`);
    console.log(`  ────────────────────────────────────────────────────────\n`);

    console.log(`  ${chalk.bold('Total Scanned Images:')}   ${chalk.white(reportData.summary.totalOriginalImages)}`);
    console.log(`  ${chalk.bold('Original Total Size:')}    ${chalk.white(formatSize(reportData.summary.totalOriginalSize))}`);
    console.log(`  ${chalk.bold('Optimized Total Size:')}   ${chalk.white(formatSize(reportData.summary.totalOptimizedSize))}`);
    console.log(`  ${chalk.bold('Space Saved:')}            ${chalk.green.bold(formatSize(reportData.summary.spaceSaved))}`);
    console.log(`  ${chalk.bold('Reduction Ratio:')}        ${chalk.green.bold(reportData.summary.averageReduction + '%')}`);
    
    if (reportData.healthScore !== null) {
      console.log(`  ${chalk.bold('Project Health Score:')}   ${chalk.cyan(reportData.healthScore)} / 100`);
    }

    if (previousCache) {
      const delta = compareCache(
        reportData.healthScore || 100,
        reportData.summary.totalOptimizedSize,
        reportData.summary.totalOriginalImages,
        previousCache
      );
      
      console.log(`\n  ${chalk.cyan.bold('Historical Progress Delta:')}`);
      if (delta.scoreImprovement !== null) {
        const sign = delta.scoreImprovement >= 0 ? '+' : '';
        console.log(`    • Score Improvement:  ${chalk.bold(sign + delta.scoreImprovement)} points`);
      }
      if (delta.sizeSavedBytes !== null && delta.sizeSavedBytes > 0) {
        console.log(`    • Saved Size Delta:   ${chalk.green.bold(formatSize(delta.sizeSavedBytes))}`);
      }
      if (delta.imageCountDelta !== null && delta.imageCountDelta !== 0) {
        const sign = delta.imageCountDelta > 0 ? '+' : '';
        console.log(`    • Scanned Files Delta: ${chalk.white(sign + delta.imageCountDelta)} images`);
      }
    }

    console.log('');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.printError("No report file found. Execute 'assetflow optimize' first to generate statistics.");
    } else {
      logger.printError(error.message || String(error));
    }
    process.exit(1);
  }
}
