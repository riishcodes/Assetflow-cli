# AssetFlow CLI

## What This Is

AssetFlow CLI is a zero-configuration, production-grade command-line image optimization engine that automatically discovers, analyzes, compresses, converts, monitors, audits, and reports image assets across a project. It is designed to run locally or in CI environments to ensure minimal file sizes and optimal visual quality without developer overhead.

## Core Value

Install once. Never think about image optimization again.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Implement image discovery engine (scanning recursive directories `src/`, `public/`, `assets/`, `images/` for png, jpg, jpeg; ignoring node_modules, .next, dist, etc.)
- [ ] Implement optimization engine (PNG/JPG/JPEG to WebP/AVIF using Sharp with presets and custom quality)
- [ ] Implement adaptive compression engine (analyzing dimensions, size, compression potential for zero visible degradation)
- [ ] Implement EXIF/GPS metadata stripping (default enabled for privacy and size reduction)
- [ ] Implement folder structure preservation (e.g., `public/images/hero.png` -> `public/images/hero.webp`)
- [ ] Implement Dry Run mode (`--dry-run` to scan, estimate savings, and report without modification)
- [ ] Implement Watch mode (`watch` command to watch directories, auto-optimize, and report in real-time)
- [ ] Implement Changed Files mode (`--changed` flag to optimize only modified assets using git diff)
- [ ] Implement Doctor command (`doctor` command to audit image health, output health score, and suggest actions)
- [ ] Implement Reporting system (colored terminal output, summary cards, and `assetflow-report.json` export)
- [ ] Implement Zod-based config system (`assetflow.config.json` support)
- [ ] Implement robust error handling (unsupported formats, corrupt images, permission issues without crashing)
- [ ] Setup testing suite (Vitest for Unit, Integration, E2E tests, aiming for 95%+ coverage)
- [ ] Configure benchmark scripts (testing 100, 500, 1000 images, measuring time, memory, savings)
- [ ] Setup CI/CD (GitHub Actions workflows for PR check and Release/Publishing)

### Out of Scope

- [ ] Cloud-based image optimization (this is a local-first, privacy-first CLI)
- [ ] Direct edit of SVG vectors (only raster optimizations and metadata stripping if applicable, though SVG is future-ready support)
- [ ] UI Dashboard or Desktop App (GSD workbench is out of scope; focus is entirely on terminal CLI experience)

## Context

- Technical Environment: Node.js, TypeScript.
- Primary Dependencies: `sharp`, `commander`, `fast-glob`, `chokidar`, `chalk`, `ora`, `zod`, `pretty-bytes`, `execa`, `vitest`.
- Target platforms: Cross-platform (Windows, macOS, Linux).

## Constraints

- **Tech Stack**: Must use specified stack (TypeScript, Commander, Sharp, Chokidar, Fast-Glob, Chalk, Ora, Zod, Pretty-Bytes, Execa, Vitest).
- **TypeScript**: Strict mode enabled, no `any` types.
- **Coverage**: Target 95%+ test coverage with Vitest.
- **Performance**: High performance for batch scanning and multi-file processing (utilizing parallel workers/promises where possible).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Sharp for processing | Native high-performance image manipulation library | — Pending |
| Commander.js for CLI | Industry standard CLI framework for Node.js | — Pending |
| Fast-Glob for file discovery | Fast recursive file listing with ignore support | — Pending |
| Chokidar for watching | Robust cross-platform file watcher for Node.js | — Pending |
| Vitest for testing | Fast, modern test runner with native TS support | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-23 after initialization*
