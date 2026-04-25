# Contributing

Thanks for your interest in contributing to GitHub Repo Visibility.

## Development setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development build:

   ```bash
   npm run dev
   ```

4. Load the generated `dist/` directory from `chrome://extensions/` with Developer mode enabled.

## Quality checks

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

For end-to-end coverage, run:

```bash
npm run test:e2e
```

## Pull requests

- Keep changes focused and describe the user-facing impact.
- Include tests for behavior changes where practical.
- Update setup or troubleshooting instructions when workflows change.
- Do not commit generated dependency folders such as `node_modules/`.

## Issues

When filing issues, include:

- Browser and version.
- Extension version or commit SHA.
- A public GitHub repository URL that reproduces the problem, if possible.
- Console errors from the GitHub page or `chrome://extensions/`, if present.
