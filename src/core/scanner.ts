import fg from 'fast-glob';
import path from 'node:path';

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
}

export interface ScannerOptions {
  directories?: string[];
  ignore?: string[];
  extensions?: string[];
}

/**
 * Scans directories recursively for target image formats, respecting ignore rules.
 * @param projectRoot Absolute path to the project root directory
 * @param options Scanner custom configuration
 * @returns Array of ScannedFile objects containing absolute, relative paths, and extensions
 */
export async function scanDirectories(
  projectRoot: string,
  options: ScannerOptions = {}
): Promise<ScannedFile[]> {
  const dirs = options.directories && options.directories.length > 0
    ? options.directories
    : ['src', 'public', 'assets', 'images'];

  const ignorePatterns = options.ignore && options.ignore.length > 0
    ? options.ignore
    : ['node_modules', '.next', 'dist', 'build', 'coverage', '.git'];

  const exts = options.extensions && options.extensions.length > 0
    ? options.extensions
    : ['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg']; // Scans all input & future-ready formats

  // Fast-glob expects forward slashes for glob patterns on all operating systems.
  // We construct globs for each directory and extension.
  const globPatterns: string[] = [];
  for (const dir of dirs) {
    // Normalize target directories relative to the project root
    const cleanDir = dir.replace(/\\/g, '/');
    const extPattern = exts.length === 1 ? exts[0] : `{${exts.join(',')}}`;
    globPatterns.push(`${cleanDir}/**/*.${extPattern}`);
    // Support case-insensitive extensions by matching both lowercase and uppercase variations.
    globPatterns.push(`${cleanDir}/**/*.${extPattern.toUpperCase()}`);
  }

  // Format ignore patterns to match fast-glob's folder structure checks.
  const processedIgnore = ignorePatterns.flatMap(pattern => {
    const clean = pattern.replace(/\\/g, '/');
    return [
      clean,
      `**/${clean}/**`,
      `${clean}/**`
    ];
  });

  const files = await fg(globPatterns, {
    cwd: projectRoot,
    absolute: true,
    ignore: processedIgnore,
    onlyFiles: true,
    stats: false,
  });

  // Map absolute paths back to ScannedFile format
  return files.map((absPath) => {
    const relativePath = path.relative(projectRoot, absPath);
    const extension = path.extname(absPath).slice(1).toLowerCase();
    return {
      absolutePath: path.resolve(absPath),
      relativePath: relativePath.replace(/\\/g, '/'), // uniform forward slashes for relative paths
      extension,
    };
  });
}
