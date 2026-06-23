# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-06-23

Initial production-ready release of AssetFlow CLI.

### Added
- Recursive glob-based image file discovery.
- In-place compression and conversion to WebP and AVIF.
- Concurrent WebP + AVIF output generation (via `format: "both"`).
- Aspect-ratio preserving responsive variants generator.
- EXIF, GPS, and color profile metadata stripping by default.
- Caching and historical fingerprinting to track health improvements.
- Deterministic doctor audit reports with project health scoring.
- Background watcher utilizing Chokidar for real-time local optimizations.
- Git diff filters to optimize changed and untracked files only.
- Zod schema validations for `assetflow.config.json`.
- Complete Vitest unit and integration test suites.
- GitHub Actions CI/CD workflows.
