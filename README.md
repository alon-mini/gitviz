# GitHub Repo Visibility

A Manifest V3 Chrome extension that adds compact visibility, activity, responsiveness, and trust signals to public GitHub repository pages.

## Requirements

- Node.js 20 or newer
- npm
- Google Chrome or another Chromium-based browser that supports Manifest V3 extensions

## Local setup

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

The production extension files are generated in the `dist/` directory.

For active development, run the watch build:

```bash
npm run dev
```

Keep this process running while editing source files. After changes rebuild, reload the extension from Chrome's extensions page.

## Load the extension in Chrome

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the generated `dist/` directory from this project.
6. Confirm that **GitHub Repo Visibility** appears in the extensions list.

## Use the extension

1. Open any public GitHub repository page, such as `https://github.com/owner/repo`.
2. The extension injects a **Repo visibility** panel into the repository page.
3. Use **Show details** to expand deeper sections, including the lazy-loaded star trend.

The extension only runs on GitHub pages and only calls the GitHub REST API. It does not require sign-in and does not use a backend service.

## Updating after code changes

After changing source files:

```bash
npm run build
```

Then return to `chrome://extensions/` and click the reload button on the **GitHub Repo Visibility** extension card.

If `npm run dev` is running, reload the extension after the watch build completes.

## Verification commands

Run TypeScript checks:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Build the Chrome extension bundle:

```bash
npm run build
```

## Troubleshooting

### The panel does not appear

- Confirm the page is a public GitHub repository page.
- Confirm the loaded unpacked extension points to the `dist/` directory, not the project root.
- Reload the GitHub page after loading or reloading the extension.
- Check `chrome://extensions/` for extension errors.

### Chrome says the manifest is invalid

- Run `npm run build` again.
- Load the generated `dist/` directory.
- Make sure the build produced `dist/manifest.json`, `dist/assets/content.js`, and `dist/assets/service-worker.js`.

### Data is unavailable or rate limited

The extension uses anonymous GitHub REST API requests. GitHub rate limits unauthenticated requests, so some data may temporarily show as unavailable or cached if the anonymous limit is reached.
