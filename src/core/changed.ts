import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Detects new, modified, or staged files tracked by git.
 * Falls back gracefully to returning null if directory is not a git repository.
 * 
 * @param projectRoot Base directory of the project
 * @returns Array of relative file paths, or null if Git is not available
 */
export async function getChangedFiles(projectRoot: string): Promise<string[] | null> {
  try {
    // Verify if directory is in a git repository
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: projectRoot });

    // 1. Get unstaged modifications
    const { stdout: unstaged } = await execa('git', ['diff', '--name-only'], { cwd: projectRoot });

    // 2. Get staged modifications
    const { stdout: staged } = await execa('git', ['diff', '--cached', '--name-only'], { cwd: projectRoot });

    // 3. Get untracked new files
    const { stdout: untracked } = await execa(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: projectRoot }
    );

    // Combine all list outputs, split by line, clean whitespace, and deduplicate
    const combinedList = new Set<string>();

    const parseAndAdd = (output: string) => {
      output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .forEach(line => combinedList.add(line));
    };

    parseAndAdd(unstaged);
    parseAndAdd(staged);
    parseAndAdd(untracked);

    const resultPaths: string[] = [];

    // Filter to ensure target files exist on the filesystem
    for (const relPath of combinedList) {
      const absPath = path.resolve(projectRoot, relPath);
      try {
        const stats = await fs.stat(absPath);
        if (stats.isFile()) {
          // Normalize paths to forward slashes
          resultPaths.push(relPath.replace(/\\/g, '/'));
        }
      } catch {
        // File does not exist, was likely deleted
      }
    }

    return resultPaths;
  } catch (error) {
    // Return null to signify that Git environment checks failed (e.g. git command missing or non-git repo)
    return null;
  }
}
