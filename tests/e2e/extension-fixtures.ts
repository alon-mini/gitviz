import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
export const extensionPath = resolve(projectRoot, 'dist');

export async function launchExtensionContext(): Promise<BrowserContext> {
  const userDataDir = await mkdtemp(resolve(tmpdir(), 'grv-e2e-'));
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
}

export async function waitForExtensionServiceWorker(context: BrowserContext): Promise<string> {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const url = worker.url();
  const [, extensionId] = url.match(/^chrome-extension:\/\/([^/]+)/) ?? [];
  if (!extensionId) throw new Error(`Could not determine extension id from ${url}`);
  return extensionId;
}

export async function mockOpenClawGitHubApi(page: Page): Promise<void> {
  const routes = page.context();
  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { etag: '"repo-e2e"' },
      body: JSON.stringify({
        full_name: 'pjasicek/OpenClaw',
        html_url: 'https://github.com/pjasicek/OpenClaw',
        description: 'A visible repository for e2e testing.',
        default_branch: 'main',
        stargazers_count: 1234,
        forks_count: 56,
        subscribers_count: 7,
        open_issues_count: 8,
        archived: false,
        fork: false,
        pushed_at: new Date().toISOString(),
        license: { spdx_id: 'MIT', name: 'MIT License' },
        topics: ['testing', 'extension']
      })
    });
  });

  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw/releases/latest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'v1.0.0', tag_name: 'v1.0.0', published_at: new Date().toISOString() })
    });
  });

  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw/community/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        health_percentage: 86,
        files: {
          readme: {},
          contributing: {},
          code_of_conduct: {},
          license: {},
          issue_template: {},
          pull_request_template: {}
        }
      })
    });
  });

  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw/stats/commit_activity', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Array.from({ length: 52 }, (_, index) => ({
        total: index > 47 ? 3 : index % 5,
        week: 1_700_000_000 + index * 604_800,
        days: [0, 1, 0, 1, 0, 1, 0]
      })))
    });
  });

  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw/pulls?state=closed&sort=updated&direction=desc&per_page=100', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { created_at: '2026-04-20T00:00:00Z', merged_at: '2026-04-21T00:00:00Z' },
        { created_at: '2026-04-21T00:00:00Z', merged_at: '2026-04-23T00:00:00Z' }
      ])
    });
  });

  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw/issues?state=closed&sort=updated&direction=desc&per_page=100', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { closed_at: '2026-04-21T00:00:00Z' },
        { closed_at: '2026-04-22T00:00:00Z', pull_request: {} },
        { closed_at: '2026-04-23T00:00:00Z' }
      ])
    });
  });

  await routes.route('https://api.github.com/repos/pjasicek/OpenClaw/stargazers?per_page=100&page=1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { starred_at: new Date().toISOString(), user: { login: 'one' } },
        { starred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), user: { login: 'two' } }
      ])
    });
  });

  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      window.dispatchEvent(new Event('popstate'));
    });
  });
}

export async function navigateToLiveOpenClawRepo(page: Page): Promise<void> {
  await page.goto('https://github.com/pjasicek/OpenClaw', { waitUntil: 'domcontentloaded' });
}

export async function navigateToOpenClawRepo(page: Page): Promise<void> {
  await page.goto('https://github.com/pjasicek/OpenClaw');
  await page.evaluate(() => {
    window.chrome = { runtime: { sendMessage: async (message: { type: string; repo: unknown }) => {
      if (message.type === 'GITHUB_VISIBILITY_GET_SUMMARY') {
        return { ok: true, type: 'summary', data: {
          repo: message.repo,
          generatedAt: new Date().toISOString(),
          cacheState: 'miss',
          repoUrl: 'https://github.com/pjasicek/OpenClaw',
          fullName: 'pjasicek/OpenClaw',
          description: 'A visible repository for e2e testing.',
          defaultBranch: 'main',
          topics: ['testing', 'extension'],
          stars: 1234,
          forks: 56,
          watchers: 7,
          openIssues: 8,
          archived: false,
          fork: false,
          license: 'MIT',
          pushedAt: new Date().toISOString(),
          pushedDaysAgo: 0,
          latestRelease: { status: 'available', name: 'v1.0.0', publishedAt: new Date().toISOString(), daysAgo: 0 },
          community: { quality: 'exact', healthPercentage: 86, files: [
            { label: 'README', present: true },
            { label: 'Contributing', present: true },
            { label: 'Code of conduct', present: true },
            { label: 'Issue template', present: true },
            { label: 'PR template', present: true },
            { label: 'License', present: true }
          ] },
          activity: { quality: 'sampled', status: 'available', headline: 'Active this month', weeks: Array.from({ length: 52 }, (_, index) => index > 47 ? 3 : index % 5), lastWeekCommits: 3, lastFourWeeksCommits: 12 },
          responsiveness: { quality: 'sampled', mergedPrCount: 2, prSampleSize: 2, medianMergeHours: 36, closedIssueCount: 2, issueSampleSize: 3 },
          notices: []
        } };
      }
      if (message.type === 'GITHUB_VISIBILITY_GET_AUTHENTICITY') {
        return { ok: true, type: 'authenticity', data: {
          repo: message.repo,
          generatedAt: new Date().toISOString(),
          cacheState: 'miss',
          quality: 'sampled',
          tone: 'healthy',
          score: 100,
          headline: 'Healthy repository authenticity signals',
          summary: 'Core ratios and sampled stargazer accounts look normal (100 recent stargazers sampled).',
          counts: { stars: 1234, forks: 56, watchers: 7 },
          ratios: {
            forkToStar: { label: 'Fork-to-star ratio', value: 0.045, formattedValue: '0.045', threshold: '< 5.0% suspicious; 10%-20% healthy', suspicious: false, healthy: false },
            watcherToStar: { label: 'Watcher-to-star ratio', value: 0.0057, formattedValue: '0.0057', threshold: '< 0.1% suspicious; 0.5%-3% healthy', suspicious: false, healthy: true }
          },
          sample: {
            requested: 100,
            size: 100,
            zeroFollowers: { label: 'Zero followers', value: 0.1, formattedValue: '10.0%', threshold: 'Flag if > 30%', suspicious: false, healthy: true },
            zeroPublicRepos: { label: 'Zero public repos', value: 0.08, formattedValue: '8.0%', threshold: 'Flag if > 25%', suspicious: false, healthy: true },
            ghostAccounts: { label: 'Ghost accounts', value: 0.01, formattedValue: '1.0%', threshold: 'Flag if > 15%; healthy repos are usually around ~1%', suspicious: false, healthy: true },
            source: 'graphql'
          },
          flags: [],
          notices: []
        } };
      }
      return { ok: true, type: 'stars', data: {
        repo: message.repo,
        generatedAt: new Date().toISOString(),
        days: 90,
        quality: 'exact',
        totalInWindow: 2,
        buckets: Array.from({ length: 90 }, (_, index) => ({ date: '2026-04-' + String(index + 1).padStart(2, '0'), count: index > 87 ? 1 : 0 })),
        pagesLoaded: 1,
        message: 'Loaded enough stargazer pages to cover the requested window.'
      } };
    } } } as typeof chrome;
  });
  const contentScript = await readFile(resolve(extensionPath, 'assets/content.js'), 'utf8');
  const executableContentScript = contentScript
    .replace(/^import[^;]+;?/, 'function g(days, empty = "Unavailable") { if (days === null) return empty; if (days === 0) return "today"; if (days === 1) return "1 day ago"; return `${days} days ago`; } function k(hours) { if (hours === null) return "Unavailable"; if (hours < 1) return `${Math.round(hours * 60)} min`; if (hours < 48) return `${Math.round(hours)} hr`; const days = hours / 24; return `${days.toFixed(days < 10 ? 1 : 0)} days`; }')
    .replace(/\/\/#[#@] sourceMappingURL=.*/g, '');
  await page.addScriptTag({ content: executableContentScript });
}

export function minimalOpenClawRepoHtml(): string {
  return `<!doctype html>
    <html>
      <head><title>pjasicek/OpenClaw</title></head>
      <body>
        <main>
          <div data-testid="repository-container-header">
            <strong>pjasicek/OpenClaw</strong>
            <ul class="pagehead-actions">
              <li><button id="repository-details-watch-button" type="button">Watch</button></li>
              <li><button id="fork-button" type="button">Fork</button></li>
              <li><button id="star-button" type="button">Star</button></li>
            </ul>
          </div>
          <nav class="js-repo-nav"></nav>
        </main>
      </body>
    </html>`;
}
