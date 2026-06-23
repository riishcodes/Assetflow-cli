import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigSchema, getDefaultConfig, type AssetFlowConfig } from './schema.js';

/**
 * Resolves preset quality settings if not explicitly overridden by the user.
 * @param rawJson Parsed JSON object from the configuration file
 * @param parsedConfig Zod-validated configuration output
 */
function applyPresetDefaults(rawJson: Record<string, any>, parsedConfig: AssetFlowConfig): AssetFlowConfig {
  const hasExplicitQuality = 'quality' in rawJson;

  if (!hasExplicitQuality) {
    const preset = parsedConfig.preset;
    if (preset === 'quality') {
      parsedConfig.quality = 95;
    } else if (preset === 'compression') {
      parsedConfig.quality = 60;
    } else {
      parsedConfig.quality = 80;
    }
  }

  return parsedConfig;
}

/**
 * Loads configuration from file if present, validates it, and merges defaults.
 * @param projectRoot Directory to check for assetflow.config.json
 * @returns Fully resolved AssetFlowConfig
 */
export async function loadConfig(projectRoot: string): Promise<AssetFlowConfig> {
  const configPath = path.join(projectRoot, 'assetflow.config.json');

  try {
    const rawContent = await fs.readFile(configPath, 'utf8');
    const json = JSON.parse(rawContent);

    // Validate using Zod schema
    const validated = ConfigSchema.parse(json);

    // Apply specific preset rules if quality wasn't explicitly set in json
    return applyPresetDefaults(json, validated);
  } catch (error: any) {
    // If the file doesn't exist, return default configuration options
    if (error.code === 'ENOENT') {
      return getDefaultConfig();
    }

    // Wrap validation/parse errors with descriptive troubleshooting info
    throw new Error(
      `Failed to parse configuration at ${configPath}:\n${error.message || error}`
    );
  }
}

/**
 * Merges loaded configuration with explicit CLI overrides.
 * @param fileConfig Config parsed from file
 * @param cliOptions Config overrides passed via command line flags
 * @returns Combined configuration settings
 */
export function mergeConfig(
  fileConfig: AssetFlowConfig,
  cliOptions: Partial<AssetFlowConfig> & { preset?: string; quality?: number }
): AssetFlowConfig {
  const merged = { ...fileConfig };

  // Override ignore patterns if CLI provides custom ignoring rules
  if (cliOptions.ignore) {
    merged.ignore = cliOptions.ignore;
  }
  if (cliOptions.directories) {
    merged.directories = cliOptions.directories;
  }

  // Handle format and watch overrides
  if (cliOptions.format) {
    merged.format = cliOptions.format;
  }
  if (cliOptions.watch !== undefined) {
    merged.watch = cliOptions.watch;
  }
  if (cliOptions.deleteOriginal !== undefined) {
    merged.deleteOriginal = cliOptions.deleteOriginal;
  }
  if (cliOptions.responsive !== undefined) {
    merged.responsive = cliOptions.responsive;
  }
  if (cliOptions.sizes) {
    merged.sizes = cliOptions.sizes;
  }
  if (cliOptions.keepMetadata !== undefined) {
    merged.keepMetadata = cliOptions.keepMetadata;
  }
  if (cliOptions.force !== undefined) {
    merged.force = cliOptions.force;
  }

  // Adjust preset and quality priority:
  // If CLI overrides preset, change quality to match that preset's defaults.
  if (cliOptions.preset && !cliOptions.quality) {
    merged.preset = cliOptions.preset as any;
    if (merged.preset === 'quality') {
      merged.quality = 95;
    } else if (merged.preset === 'compression') {
      merged.quality = 60;
    } else {
      merged.quality = 80;
    }
  }

  // If CLI overrides quality directly, it takes absolute precedence.
  if (cliOptions.quality) {
    merged.quality = cliOptions.quality;
  }

  return ConfigSchema.parse(merged);
}
