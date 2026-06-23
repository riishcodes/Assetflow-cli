import { describe, it, expect } from 'vitest';
import { ConfigSchema, getDefaultConfig } from '../config/schema.js';
import { mergeConfig } from '../config/manager.js';

describe('Configuration Schema & Merging', () => {
  it('should parse and load defaults correctly', () => {
    const defaults = getDefaultConfig();
    expect(defaults.quality).toBe(80);
    expect(defaults.format).toBe('webp');
    expect(defaults.deleteOriginal).toBe(false);
    expect(defaults.ignore).toContain('node_modules');
    expect(defaults.preset).toBe('balanced');
    expect(defaults.responsive).toBe(false);
    expect(defaults.sizes).toEqual([640, 1280, 1920]);
  });

  it('should validate custom settings correctly', () => {
    const custom = ConfigSchema.parse({
      quality: 90,
      format: 'both',
      preset: 'quality',
      responsive: true,
      sizes: [320, 480],
    });

    expect(custom.quality).toBe(90);
    expect(custom.format).toBe('both');
    expect(custom.preset).toBe('quality');
    expect(custom.responsive).toBe(true);
    expect(custom.sizes).toEqual([320, 480]);
  });

  it('should fail validation on invalid values', () => {
    expect(() => ConfigSchema.parse({ quality: 120 })).toThrow();
    expect(() => ConfigSchema.parse({ format: 'png' })).toThrow();
    expect(() => ConfigSchema.parse({ preset: 'ultra' })).toThrow();
    expect(() => ConfigSchema.parse({ sizes: [-50] })).toThrow();
  });

  it('should merge command line options over loaded config', () => {
    const baseConfig = getDefaultConfig();
    
    // Override format and quality
    const merged = mergeConfig(baseConfig, {
      format: 'avif',
      quality: 75,
    });

    expect(merged.format).toBe('avif');
    expect(merged.quality).toBe(75);
    expect(merged.preset).toBe('balanced'); // Unchanged
  });

  it('should apply preset-specific default quality on merge', () => {
    const baseConfig = getDefaultConfig();

    // Select quality preset without providing a custom quality override
    const mergedQuality = mergeConfig(baseConfig, {
      preset: 'quality',
    });
    expect(mergedQuality.preset).toBe('quality');
    expect(mergedQuality.quality).toBe(95);

    // Select compression preset
    const mergedCompression = mergeConfig(baseConfig, {
      preset: 'compression',
    });
    expect(mergedCompression.preset).toBe('compression');
    expect(mergedCompression.quality).toBe(60);
  });
});
