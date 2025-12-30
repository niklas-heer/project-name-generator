# Project Name Generator

A CLI tool to check name availability across package registries, repositories, domains, and trademarks.

## Quick Start

```bash
bun install                    # Install dependencies
just check myproject           # Check a name
just check-json myproject      # Output as JSON
just list                      # List all checkers
```

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── types.ts            # TypeScript types and constants
└── checkers/           # Individual platform checkers
    ├── index.ts        # Exports all checkers
    ├── base.ts         # Shared utilities (fetch, error handling)
    ├── npm.ts          # npm & npm org
    ├── pypi.ts         # PyPI
    ├── crates.ts       # crates.io
    ├── nuget.ts        # NuGet
    ├── go.ts           # Go packages
    ├── packagist.ts    # PHP Packagist
    ├── homebrew.ts     # Homebrew
    ├── nixpkgs.ts      # Nix packages
    ├── github.ts       # GitHub repos & orgs
    ├── gitlab.ts       # GitLab projects
    ├── domain.ts       # .dev domain (RDAP)
    └── trademark.ts    # USPTO, Google, FOSSmarks
```

## Requirements

- **Bun**: Use `bun` instead of Node.js
- **GitHub Token**: Required for GitHub checks. Set `GITHUB_TOKEN` env var.

## Adding a New Checker

1. Create a new file in `src/checkers/`
2. Implement the `Checker` interface from `types.ts`
3. Export and register in `src/checkers/index.ts`

## Bun Conventions

- Use `bun <file>` instead of `node <file>`
- Use `bun test` for testing
- Use `bun install` for dependencies
- Bun auto-loads `.env` files
