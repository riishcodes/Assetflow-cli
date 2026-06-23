# AssetFlow CLI

> **Install once. Never think about image optimization again.**

AssetFlow CLI is a zero-configuration, production-grade command-line image optimization engine that automatically discovers, analyzes, compresses, converts, monitors, audits, and reports image assets across a project. It is designed to run locally or in CI environments to ensure minimal file sizes and optimal visual quality without developer overhead.

[![npm version](https://img.shields.io/npm/v/assetflow-cli?style=flat-square&color=black)](https://www.npmjs.com/package/assetflow-cli)
[![License](https://img.shields.io/npm/l/assetflow-cli?style=flat-square&color=black)](LICENSE)

---

## Features

- ⚡ **Zero Configuration**: Out-of-the-box support for recursive scanning.
- 🖼️ **Multi-Format Output**: Compress and convert images to `webp`, `avif`, or generate `both` formats simultaneously.
- 📐 **Responsive Variants**: Automatically scale and resize images into multiple responsive widths.
- 🛡️ **EXIF Metadata Stripping**: Strips Exif, GPS, and camera parameters by default for privacy and size reductions.
- 🩺 **Health Audit Doctor**: Deterministic scoring and largest bottleneck identification.
- 📦 **Historical Delta Cache**: Fingerprints project status to track improvements over runs.
- ⏱️ **Watch Mode**: Listens for filesystem additions/modifications and optimizes them in real-time.
- 🌿 **Git Changed Filter**: Target only modified or unstaged assets to speed up local verification and CI.

---

## Installation

Run directly using `npx`:

```bash
npx assetflow
```

Or install globally:

```bash
npm install -g assetflow-cli
```

---

## CLI Reference

### `assetflow` / `assetflow optimize`
Discovers and optimizes target image folders.

```bash
# Basic run (optimizes in-place to WebP format)
assetflow

# Estimate savings without modifying files
assetflow --dry-run

# Process only modified/staged/untracked files in git
assetflow --changed

# Force output format webp, avif, or both
assetflow --format both

# Run with a custom quality or compression preset
assetflow --quality 85 --preset quality
```

### `assetflow watch`
Starts a background watcher to optimize new/modified assets.

```bash
assetflow watch
```

### `assetflow doctor`
Audits project image assets, shows the largest assets, and calculates a deterministic Health Score.

```bash
assetflow doctor
```

### `assetflow report`
Displays metrics and comparison deltas from the last optimization run.

```bash
assetflow report
```

---

## Configuration

Place an `assetflow.config.json` file in the root of your project:

```json
{
  "quality": 80,
  "format": "both",
  "deleteOriginal": false,
  "directories": ["src", "public"],
  "ignore": ["node_modules", ".next"],
  "preset": "balanced",
  "keepMetadata": false,
  "responsive": true,
  "sizes": [640, 1280]
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `quality` | `number` | `80` | Compression quality override (1-100) |
| `format` | `"webp" \| "avif" \| "both"` | `"webp"` | Target output format |
| `deleteOriginal` | `boolean` | `false` | Deletes source images after optimization |
| `directories` | `string[]` | `["src", "public", "assets", "images"]` | Paths to scan recursively |
| `ignore` | `string[]` | `["node_modules", ".next", "dist", "build", "coverage", ".git"]` | Glob patterns to ignore |
| `preset` | `"balanced" \| "quality" \| "compression"` | `"balanced"` | Quality preset selection |
| `keepMetadata` | `boolean` | `false` | Retains Exif and color profile tags |
| `responsive` | `boolean` | `false` | Generate resized width variants |
| `sizes` | `number[]` | `[640, 1280, 1920]` | Target widths to generate |

---

## Auditing & Scoring Mechanics

The `doctor` command uses a deterministic scoring formula starting at **100**:

- **`-5` points** per source image larger than **1MB**.
- **`-2` points** per source PNG larger than **500KB**.
- **`-3` points** per image containing unstripped EXIF/GPS/color metadata.
- **`-5` points** per source image lacking optimized WebP or AVIF alternative versions.

*(Minimum score is capped at 0.)*

---

## License

MIT
