import { expect, test } from '@playwright/test';
import { launchExtensionContext, minimalOpenClawRepoHtml, mockOpenClawGitHubApi, navigateToLiveOpenClawRepo, navigateToOpenClawRepo, waitForExtensionServiceWorker } from './extension-fixtures';

test.describe('GitHub Repo Visibility extension', () => {
  test('loads as an unpacked Chromium extension', async () => {
    const context = await launchExtensionContext();
    try {
      const extensionId = await waitForExtensionServiceWorker(context);
      expect(extensionId).toMatch(/^[a-p]{32}$/);
    } finally {
      await context.close();
    }
  });

  test('injects repo visibility panel and renders mocked OpenClaw GitHub metrics', async () => {
    const context = await launchExtensionContext();
    try {
      await waitForExtensionServiceWorker(context);
      const page = await context.newPage();
      await mockOpenClawGitHubApi(page);
      await page.route('https://github.com/pjasicek/OpenClaw', async (route) => {
        await route.fulfill({ status: 200, contentType: 'text/html', body: minimalOpenClawRepoHtml() });
      });

      await navigateToOpenClawRepo(page);
      await expect(page.locator('#repository-container-header').getByText('pjasicek/OpenClaw')).toBeVisible();

      const actionLabels = await page.locator('.pagehead-actions > li').evaluateAll((items) => items.map((item) => item.querySelector('button, a, summary')?.textContent?.trim().replace(/\s+/g, ' ')));
      expect(actionLabels).toEqual(['Watch', 'Health 84/100', 'Fork', 'Star']);
      await expect(page.locator('#star-button')).toBeVisible();
      const healthButton = page.locator('#github-repo-visibility-action-root').getByRole('button', { name: /Health/ });
      const authenticityButton = page.locator('#github-repo-visibility-action-root').getByRole('button', { name: /Authenticity/ });
      await expect(healthButton).toBeVisible();
      await expect(healthButton).toContainText('84/100');
      await expect(authenticityButton).toBeVisible();
      await expect(authenticityButton).toContainText('100/100');
      await healthButton.click();
      const healthDialog = page.getByRole('dialog', { name: 'Health panel' });
      await expect(healthDialog.getByText('Health repository signals')).toBeVisible();
      await expect(healthDialog).toHaveCSS('position', 'fixed');
      await expect(healthDialog).toHaveCSS('resize', 'both');

      const panel = healthDialog.locator('.gra-panel-root');
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading', { name: 'pjasicek/OpenClaw' })).toBeVisible();
      await expect(panel.getByText('Healthy repository authenticity signals')).toBeVisible();
      await expect(panel.getByLabel('Health: 84/100')).toBeVisible();
      await expect(panel.getByText('Stars', { exact: true })).toBeVisible();
      await expect(panel.getByLabel('Stars: 1,234')).toBeVisible();
      await expect(panel.getByText('Watchers', { exact: true })).toBeVisible();
      await expect(panel.getByLabel('Watchers: 7')).toBeVisible();
      await expect(panel.getByLabel('Activity snapshot').getByText('Active this month')).toBeVisible();
      await expect(panel.getByText('2/2')).toBeVisible();
      await expect(panel.getByText('2/3')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('lazy-loads star trend when details are expanded', async () => {
    const context = await launchExtensionContext();
    try {
      await waitForExtensionServiceWorker(context);
      const page = await context.newPage();
      await mockOpenClawGitHubApi(page);
      await page.route('https://github.com/pjasicek/OpenClaw', async (route) => {
        await route.fulfill({ status: 200, contentType: 'text/html', body: minimalOpenClawRepoHtml() });
      });

      await navigateToOpenClawRepo(page);
      const healthButton = page.locator('#github-repo-visibility-action-root').getByRole('button', { name: /Health/ });
      await expect(healthButton).toBeVisible();
      await healthButton.click();
      const panel = page.getByRole('dialog', { name: 'Health panel' }).locator('.gra-panel-root');
      await expect(panel.getByRole('heading', { name: 'pjasicek/OpenClaw' })).toBeVisible();
      await panel.getByRole('button', { name: 'Show details' }).click();

      await expect(panel.getByText('Health factors')).toBeVisible();
      await expect(panel.getByText(/stars in 90 days/)).toBeVisible();
      await expect(panel.getByText(/pages loaded/)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('renders live OpenClaw metrics from real GitHub API calls', async () => {
    const context = await launchExtensionContext();
    try {
      await waitForExtensionServiceWorker(context);
      const page = await context.newPage();
      const apiRequests: string[] = [];
      context.on('request', (request) => {
        const url = request.url();
        if (url.startsWith('https://api.github.com/repos/pjasicek/OpenClaw')) {
          apiRequests.push(url);
        }
      });

      await navigateToLiveOpenClawRepo(page);

      const healthButton = page.locator('#github-repo-visibility-action-root').getByRole('button', { name: /Health/ });
      await expect(healthButton).toBeVisible({ timeout: 20_000 });
      await healthButton.click();

      const panel = page.getByRole('dialog', { name: 'Health panel' }).locator('.gra-panel-root');
      await expect(panel).toBeVisible({ timeout: 20_000 });
      await expect(panel.getByRole('heading', { name: 'pjasicek/OpenClaw' })).toBeVisible();
      await expect(panel.locator('.grv-panel')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
      const rateLimitNotice = panel.getByText('Anonymous GitHub API limit reached. Showing cached data when available.');
      if (await rateLimitNotice.isVisible()) {
        await expect(rateLimitNotice).toBeVisible();
      } else {
        await expect(panel.getByText('Stars', { exact: true })).toBeVisible();
        await expect(panel.getByText('Forks', { exact: true })).toBeVisible();
        await expect(panel.getByText('Watchers', { exact: true })).toBeVisible();
        await expect(panel.getByLabel('Activity snapshot').getByText('Activity', { exact: true })).toBeVisible();
      }
      expect(apiRequests.some((url) => url === 'https://api.github.com/repos/pjasicek/OpenClaw')).toBe(true);
    } finally {
      await context.close();
    }
  });
});
