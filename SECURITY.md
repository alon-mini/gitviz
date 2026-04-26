# Security Policy

## Supported versions

Security updates are provided for the latest version on the default branch.

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities.

Report vulnerabilities using GitHub's private vulnerability reporting feature if it is enabled for this repository. If that is unavailable, contact the repository owner through GitHub with enough detail to reproduce and assess the issue.

Useful details include:

- Affected extension version or commit SHA.
- Steps to reproduce.
- Expected and actual impact.
- Browser version and operating system.

## Scope

This project is a Chrome extension that runs on GitHub pages and calls the GitHub REST API. Reports involving unsafe page injection, data exposure, permission misuse, remote-code execution, or supply-chain concerns are in scope.

## Security practices

The extension is designed to keep permissions narrow and understandable:

- It requests `storage` only for local cache and state.
- It runs content scripts only on `https://github.com/*`.
- It calls the official GitHub API at `https://api.github.com/*`.
- It does not load or execute remotely hosted extension code.
- It does not operate a developer-controlled backend for extension data.

## Expected response

Security reports will be reviewed as soon as practical. If a vulnerability is confirmed, a fix will be prepared for the default branch and included in the next Chrome Web Store submission.

