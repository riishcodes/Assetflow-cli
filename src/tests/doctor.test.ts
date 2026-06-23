import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runDoctorAudit } from '../core/doctor-engine.js';
import { setupTestWorkspace, cleanupTestWorkspace, getWorkspaceRoot } from './helpers.js';
import { scanDirectories } from '../core/scanner.js';

describe('Doctor Auditing & Health Scoring', () => {
  const root = getWorkspaceRoot('doctor');

  beforeAll(async () => {
    await setupTestWorkspace('doctor');
  });

  afterAll(async () => {
    await cleanupTestWorkspace('doctor');
  });

  it('should run audit, identify largest files, and suggest actions', async () => {
    const files = await scanDirectories(root);
    const audit = await runDoctorAudit(files);

    expect(audit.totalImages).toBe(2);
    expect(audit.totalSize).toBeGreaterThan(0);
    expect(audit.potentialSavingsBytes).toBeGreaterThan(0);

    // Verify Largest Assets list
    expect(audit.largestAssets.length).toBe(2);
    expect(audit.largestAssets[0].size).toBeGreaterThanOrEqual(audit.largestAssets[1].size);

    expect(audit.healthScore).toBe(90);

    expect(audit.recommendations.length).toBeGreaterThan(0);
    const hasConvertRec = audit.recommendations.some(r => r.includes('Convert'));
    expect(hasConvertRec).toBe(true);
  });
});
