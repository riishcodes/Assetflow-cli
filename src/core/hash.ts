import crypto from 'node:crypto';
import fs from 'node:fs/promises';

/**
 * Calculates a SHA-256 checksum of a file to detect changes.
 * @param filePath Absolute path to the target file
 * @returns Hex-encoded checksum string
 */
export async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
