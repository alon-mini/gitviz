# Privacy Policy

Effective date: April 26, 2026

GitHub Repo Visibility is a Manifest V3 Chrome extension that adds a compact repository-quality panel to public GitHub repository pages. It summarizes public GitHub repository signals such as stars, forks, watchers, recent activity, releases, responsiveness, community health, and stargazer trend/authenticity indicators.

## Data the extension handles

When you visit a GitHub repository page, the extension reads the current GitHub URL to identify the repository owner and name. It uses that repository identifier to request public repository data from the official GitHub API.

The extension may process public GitHub data returned by the GitHub API, including repository metadata, release metadata, commit activity summaries, closed pull request and issue metadata, community profile information, stargazer timestamps, and public user profile fields for sampled stargazers when authenticity sampling is available.

The extension does not collect your name, email address, financial information, health information, precise location, personal communications, form data, or general browsing history.

## How data is used

The extension uses the data it handles only to provide its single purpose: displaying public GitHub repository visibility and quality signals on GitHub repository pages.

The extension does not use data for advertising, personalized ads, retargeting, creditworthiness, lending, or sale to data brokers.

## Data sharing

The extension sends repository identifiers and related API requests to GitHub over HTTPS so GitHub can return the public repository data needed for the extension panel. GitHub's handling of those requests is governed by GitHub's own terms and privacy policy.

The extension does not operate a developer-controlled backend and does not send extension data to the developer. The extension does not sell or share user data with advertisers, analytics providers, data brokers, or other third parties.

## Local storage and retention

The extension stores cached repository metrics and rate-limit state locally in your browser using browser storage and IndexedDB. This cache reduces repeated GitHub API requests, improves performance, and helps the extension show recently loaded data when GitHub API requests are unavailable or rate limited.

Local cache data remains on your device unless you remove the extension, clear the extension's site/storage data through your browser, or the extension overwrites cached entries during normal use.

## Remote code

The extension does not load or execute remotely hosted code. All extension logic is packaged with the extension. Network requests to GitHub are used only to retrieve data for local display and calculation.

## Security

Data transmitted by the extension to GitHub uses HTTPS. Security vulnerabilities can be reported according to the project's security policy.

## Chrome Web Store Limited Use disclosure

The use of information received from Chrome extension permissions will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes to this policy

This policy may be updated when the extension's behavior changes or when required for Chrome Web Store compliance. Updates will be published in this repository.

## Contact

For privacy questions, contact the repository owner through the GitHub repository at https://github.com/alon-mini/gitviz.
