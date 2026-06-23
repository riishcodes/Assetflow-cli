# Contributing to AssetFlow CLI

First off, thank you for checking out AssetFlow! We welcome contributions of all sizes.

## Development Setup

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build TypeScript source**:
   ```bash
   npm run build
   # Or start compiler watch mode
   npm run dev
   ```
4. **Run tests**:
   ```bash
   npm run test
   ```

## Guidelines

- **Strict Typing**: Strict TypeScript mode is enabled. Do not use `any` types.
- **Testing**: Ensure that unit tests are added or updated to cover your new features.
- **Visual Integrity**: Verify that optimized outputs do not contain visual degradation.
- **Commit Messages**: Follow clean semantic formatting (e.g. `feat: add SVG support`, `fix: ignore dotfiles in watch`).
