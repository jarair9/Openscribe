# Security Policy

## Reporting a vulnerability

If you discover a security issue in Openscribe, please report it privately
rather than in a public issue:

- Open a [GitHub security advisory](https://github.com/jarair9/Openscribe/security/advisories/new), or
- Contact the maintainer ([@jarair9](https://github.com/jarair9)) through
  GitHub with "security" in the subject.

We aim to acknowledge reports within 5 business days and will keep you
informed of the fix timeline.

## Scope

Openscribe is a local-first desktop app: projects, assets, and exports stay
on your machine, and the app makes no network requests. Security reports may
cover, for example:

- Privilege escalation through the IPC bridge (`src/preload`)
- Path traversal in project/asset file handling (`src/main`)
- Code execution via crafted project files or imported SVGs
- Unsafe Electron window or protocol configuration

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x and newer | Yes |
| Anything older | Best effort |
