# Project Name Generator

A CLI tool to generate project names using AI, check availability across package registries, repositories, domains, and trademarks, then critically evaluate candidates.

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
├── generator.ts        # AI name generation
├── judge.ts            # AI evaluation/judging
├── interactive.ts      # Interactive & auto-iterate modes
├── openrouter.ts       # OpenRouter API client
├── profiles.ts         # Checker profile loader
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

config/
├── models.yaml         # AI model configuration
└── profiles.yaml       # Checker profiles

prompts/
├── generate-names.md   # Name generation prompt
└── judge-names.md      # Judging prompt
```

## Requirements

- **Bun**: Use `bun` instead of Node.js
- **GitHub Token**: Required for GitHub checks. Set `GITHUB_TOKEN` env var.
- **OpenRouter API Key**: Required for AI generation/judging. Set `OPENROUTER_API_KEY` env var.

## Adding a New Checker

1. Create a new file in `src/checkers/`
2. Implement the `Checker` interface from `types.ts`
3. Export and register in `src/checkers/index.ts`

## Bun Conventions

- Use `bun <file>` instead of `node <file>`
- Use `bun test` for testing
- Use `bun install` for dependencies
- Bun auto-loads `.env` files

## Updating AI Models

Models are configured in `config/models.yaml`. To get the latest available models from OpenRouter:

```bash
# Get latest models from key providers (OpenAI, Anthropic, Google, Kimi)
# sorted by creation date (newest first)
curl -s "https://openrouter.ai/api/v1/models" | jq '
  .data 
  | map(select(.id | test("^(openai|anthropic|google|moonshotai)/"))) 
  | sort_by(.created) 
  | reverse 
  | .[0:30] 
  | .[] 
  | {id: .id, name: .name, created: .created}
'

# Get ALL models from a specific provider
curl -s "https://openrouter.ai/api/v1/models" | jq '
  .data[] 
  | select(.id | startswith("openai/")) 
  | {id: .id, name: .name}
'

# Search for specific model patterns
curl -s "https://openrouter.ai/api/v1/models" | jq '
  .data[] 
  | select(.id | test("gpt-5|gemini-3|claude-4")) 
  | {id: .id, name: .name}
'
```

The `.created` field is a Unix timestamp - higher = newer. Update `config/models.yaml` with new model IDs as needed.

API docs: https://openrouter.ai/docs/api/api-reference/models/get-models
