import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { execa } from 'execa';

const FIXTURES_ROOT = path.resolve(process.cwd(), 'validation-fixtures');
const cliBinary = path.resolve(process.cwd(), 'dist', 'index.js');

async function createMockImage(filePath: string, width: number, height: number, r: number, g: number, b: number): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r, g, b, alpha: 1 }
    }
  }).png().toFile(filePath);
}

async function runValidation(): Promise<void> {
  console.log('Setting up validation fixtures...');
  await fs.mkdir(FIXTURES_ROOT, { recursive: true });

  // 1. React Fixture
  const reactRoot = path.join(FIXTURES_ROOT, 'react-project');
  await fs.mkdir(reactRoot, { recursive: true });
  await createMockImage(path.join(reactRoot, 'src', 'assets', 'hero.png'), 800, 600, 200, 50, 50);
  await fs.writeFile(
    path.join(reactRoot, 'assetflow.config.json'),
    JSON.stringify({ format: 'webp', quality: 80, directories: ['src'] }, null, 2)
  );

  // 2. Vite Fixture
  const viteRoot = path.join(FIXTURES_ROOT, 'vite-project');
  await fs.mkdir(viteRoot, { recursive: true });
  await createMockImage(path.join(viteRoot, 'public', 'banner.jpg'), 1200, 400, 50, 200, 50);
  await fs.writeFile(
    path.join(viteRoot, 'assetflow.config.json'),
    JSON.stringify({ format: 'avif', quality: 75, directories: ['public'] }, null, 2)
  );

  // 3. Next.js Fixture
  const nextRoot = path.join(FIXTURES_ROOT, 'nextjs-project');
  await fs.mkdir(nextRoot, { recursive: true });
  await createMockImage(path.join(nextRoot, 'public', 'logo.png'), 400, 400, 50, 50, 200);
  await fs.writeFile(
    path.join(nextRoot, 'assetflow.config.json'),
    JSON.stringify({ format: 'both', responsive: true, sizes: [320], directories: ['public'] }, null, 2)
  );

  console.log('Executing CLI runs...');
  
  // React CLI Run
  const reactStart = Date.now();
  const { stdout: reactStdout } = await execa('node', [cliBinary], { cwd: reactRoot });
  const reactTime = Date.now() - reactStart;
  const reactReport = JSON.parse(await fs.readFile(path.join(reactRoot, 'assetflow-report.json'), 'utf8'));

  // Vite CLI Run
  const viteStart = Date.now();
  const { stdout: viteStdout } = await execa('node', [cliBinary], { cwd: viteRoot });
  const viteTime = Date.now() - viteStart;
  const viteReport = JSON.parse(await fs.readFile(path.join(viteRoot, 'assetflow-report.json'), 'utf8'));

  // Next.js CLI Run
  const nextStart = Date.now();
  const { stdout: nextStdout } = await execa('node', [cliBinary], { cwd: nextRoot });
  const nextTime = Date.now() - nextStart;
  const nextReport = JSON.parse(await fs.readFile(path.join(nextRoot, 'assetflow-report.json'), 'utf8'));

  console.log('Compiling markdown results...');
  const mdReport = `# Validation Results: Fixture Projects

This document details the validation testing outcomes of the AssetFlow CLI across React, Vite, and Next.js configurations.

## React Project Audit
- **Configuration**: Format WebP, Quality 80, directories: \`src/\`
- **Execution Time**: ${reactTime}ms
- **Original Image Size**: ${reactReport.summary.totalOriginalSize} bytes
- **Optimized Image Size**: ${reactReport.summary.totalOptimizedSize} bytes
- **Space Saved**: ${reactReport.summary.spaceSaved} bytes
- **Average Size Reduction**: ${reactReport.summary.averageReduction}%
- **Deterministic Health Score**: ${reactReport.healthScore}/100
- **Log Outputs**:
\`\`\`text
${reactStdout.trim()}
\`\`\`

## Vite Project Audit
- **Configuration**: Format AVIF, Quality 75, directories: \`public/\`
- **Execution Time**: ${viteTime}ms
- **Original Image Size**: ${viteReport.summary.totalOriginalSize} bytes
- **Optimized Image Size**: ${viteReport.summary.totalOptimizedSize} bytes
- **Space Saved**: ${viteReport.summary.spaceSaved} bytes
- **Average Size Reduction**: ${viteReport.summary.averageReduction}%
- **Deterministic Health Score**: ${viteReport.healthScore}/100
- **Log Outputs**:
\`\`\`text
${viteStdout.trim()}
\`\`\`

## Next.js Project Audit
- **Configuration**: Format Both (WebP & AVIF), Responsive: true (width 320px), directories: \`public/\`
- **Execution Time**: ${nextTime}ms
- **Original Image Size**: ${nextReport.summary.totalOriginalSize} bytes
- **Optimized Image Size**: ${nextReport.summary.totalOptimizedSize} bytes
- **Space Saved**: ${nextReport.summary.spaceSaved} bytes
- **Average Size Reduction**: ${nextReport.summary.averageReduction}%
- **Deterministic Health Score**: ${nextReport.healthScore}/100
- **Log Outputs**:
\`\`\`text
${nextStdout.trim()}
\`\`\`

---
*Validation executed: ${new Date().toISOString()}*
`;

  const reportPath = path.resolve(
    process.cwd(),
    '..',
    '..',
    '..',
    '.gemini',
    'antigravity-ide',
    'brain',
    '2900f3f3-0095-42c0-a001-a72d963fe5d5',
    'validation_results.md'
  );

  await fs.writeFile(reportPath, mdReport, 'utf8');
  console.log(`Validation report written to: ${reportPath}`);

  // Clean up fixtures
  await fs.rm(FIXTURES_ROOT, { recursive: true, force: true });
  console.log('Cleanup completed.');
}

runValidation().catch(console.error);
