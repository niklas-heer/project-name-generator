# project-name-generator

A CLI tool to generate project names using AI, check availability across package registries, repositories, and domains, then critically evaluate candidates.

## Installation

```bash
bun install

# Copy and configure environment variables
cp env.example .env
# Edit .env with your GITHUB_TOKEN and OPENROUTER_API_KEY
```

## Quick Start

```bash
# Generate name candidates with AI
bun run src/cli.ts generate "A CLI task runner for automating dev workflows" -n 10

# Auto-generate until you find 3 available names
bun run src/cli.ts generate "A CLI task runner" -n 5 -u 3 -p minimal

# Judge candidates with a critical AI reviewer
bun run src/cli.ts judge "A CLI task runner" blitz flux rayo takt kura

# Check a specific name across all platforms
bun run src/cli.ts check myproject
```

## Commands

### `generate` - AI Name Generation

Generate project name candidates using AI models with linguistic research-backed strategies.

```bash
bun run src/cli.ts generate <description> [options]

Options:
  -n, --count <number>         Number of names to generate (default: 20)
  -m, --model <model>          AI model to use (default: claude-sonnet)
  -s, --style <style>          Name style: short, word, compound, all
  --sources <languages>        Comma-separated language sources
  -i, --interactive            Interactive mode with continuous generation
  -u, --until-available <N>    Keep generating until N names meet threshold
  -t, --threshold <percent>    Availability threshold (default: 80)
  -p, --profile <name>         Checker profile (minimal, node, python, rust, go, full)
  -e, --exclude <names>        Comma-separated names to exclude
  --exclude-from <file>        Exclude names from file (JSON or text)
  -j, --json                   Output as JSON
```

**Examples:**

```bash
# Simple generation
bun run src/cli.ts generate "A Python-to-binary compiler"

# Interactive mode - refine with feedback
bun run src/cli.ts generate "A Python-to-binary compiler" -i

# Auto-iterate until finding 3 available names (80%+ availability)
bun run src/cli.ts generate "A CLI task runner" -n 5 -u 3 -p minimal

# Continue from previous run, excluding already-tried names
bun run src/cli.ts generate "A CLI task runner" -u 3 --exclude-from run1.json --json > run2.json

# Use a specific model
bun run src/cli.ts generate "A CLI task runner" -m gemini-flash
```

### `judge` - Critical Evaluation

Evaluate name candidates with a harsh but fair AI judge. Scores on typability, memorability, meaning, uniqueness, and cultural risk.

```bash
bun run src/cli.ts judge <description> [names...] [options]

Options:
  -m, --model <model>    Judge model (default: gemini-2.5-pro)
  -f, --from-file <file> Read names from file (JSON from generate, or text)
  -o, --output <file>    Write markdown report to file
  -j, --json             Output raw JSON
```

**Examples:**

```bash
# Judge names directly
bun run src/cli.ts judge "A CLI task runner" blitz flux rayo takt

# Judge from a previous generate run
bun run src/cli.ts generate "A task runner" -n 10 --json > candidates.json
bun run src/cli.ts judge "A task runner" -f candidates.json -o report.md

# Use a different judge model
bun run src/cli.ts judge "A task runner" -f candidates.json -m claude-sonnet
```

**Scoring (1-5):**
- **Typability** - Easy to type, no awkward key combos
- **Memorability** - Sticks in the mind
- **Meaning** - Relevant to project purpose
- **Uniqueness** - Stands out, not already overused
- **Cultural Risk** - 1=safe, 5=problematic

**Verdicts:**
- ✅ **strong** - Overall 4.0+, no score below 3, low cultural risk
- 🤔 **consider** - Decent but has weak areas
- ❌ **reject** - Critical flaws

### `check` - Availability Check

Check name availability across package registries, repositories, domains, and trademarks.

```bash
bun run src/cli.ts check <name> [options]

Options:
  -j, --json             Output as JSON
  -o, --only <checkers>  Only run specific checkers
  -s, --skip <checkers>  Skip specific checkers
```

**Examples:**

```bash
# Full check
bun run src/cli.ts check myproject

# Quick check (minimal platforms)
bun run src/cli.ts check myproject --only npm,pypi,domain-dev

# Skip slow trademark checks
bun run src/cli.ts check myproject --skip uspto,google-software,google-opensource,fossmarks

# JSON for scripting
bun run src/cli.ts check myproject --json
```

### Other Commands

```bash
# List all available checkers
bun run src/cli.ts list

# List available AI models
bun run src/cli.ts models

# List checker profiles
bun run src/cli.ts profiles
```

## Typical Workflow

```bash
# 1. Generate candidates with auto-iteration
bun run src/cli.ts generate "A Python-to-binary compiler with 6ms startup" \
  -n 5 -u 3 -p minimal --json > candidates.json

# 2. Judge the qualified names
bun run src/cli.ts judge "A Python-to-binary compiler" \
  -f candidates.json -o report.md

# 3. Check the winner in full detail
bun run src/cli.ts check rayo

# 4. Continue if needed, excluding previous attempts
bun run src/cli.ts generate "A Python-to-binary compiler" \
  -n 5 -u 3 --exclude-from candidates.json --json > candidates2.json
```

## Available Checkers

### Package Registries
- `npm` - npm packages
- `npm-org` - npm organizations
- `pypi` - Python Package Index
- `crates` - Rust crates (crates.io)
- `nuget` - .NET packages
- `go` - Go packages
- `packagist` - PHP packages
- `homebrew` - Homebrew formulas and casks
- `nixpkgs` - Nix packages

### Code Repositories
- `github` - GitHub repositories
- `github-org` - GitHub organizations (checks 15 common variants like -dev, -hq, -org)
- `github-uniqueness` - How many similar repos exist (uniqueness score)
- `gitlab` - GitLab projects

### Domains
- `domain-dev` - .dev domain availability via RDAP

### Trademark Checks
- `uspto` - USPTO TESS database (manual check URL)
- `google-software` - Google search for "[name] software"
- `google-opensource` - Google search for "[name] open source"
- `fossmarks` - FOSSmarks.org guidance

## Checker Profiles

Speed up availability checks by using profiles:

| Profile | Checkers | Use Case |
|---------|----------|----------|
| `minimal` | npm, pypi, domain-dev | Quick iteration |
| `node` | npm, npm-org, github, domain-dev | Node.js projects |
| `python` | pypi, github, domain-dev | Python projects |
| `rust` | crates, github, domain-dev | Rust projects |
| `go` | go, github, domain-dev | Go projects |
| `full` | All package + repo + domain | Thorough check |
| `complete` | Everything including trademarks | Final verification |

## AI Models

Available models for generation and judging:

| Alias | Model | Best For |
|-------|-------|----------|
| `claude-sonnet` | Claude Sonnet 4 | High-quality generation (default) |
| `claude-haiku` | Claude 3.5 Haiku | Fast, cheap iteration |
| `gpt-4o` | GPT-4o | Alternative perspective |
| `gpt-4o-mini` | GPT-4o Mini | Budget option |
| `gemini-flash` | Gemini 2.0 Flash | Fast generation |
| `gemini-2.5-pro` | Gemini 2.5 Pro | Critical judging (default for judge) |
| `llama-70b` | Llama 3.3 70B | Open source option |

## Configuration

### Environment Variables

Copy `env.example` to `.env`:

```bash
# Required for GitHub checks
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Required for AI generation/judging
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxx
```

### Checker Profiles

Customize profiles in `config/profiles.yaml`:

```yaml
minimal:
  description: "Quick check - just the essentials"
  checkers:
    - npm
    - pypi
    - domain-dev

custom:
  description: "My custom profile"
  checkers:
    - npm
    - github
    - crates
```

### Prompts

Customize AI prompts in `prompts/`:
- `generate-names.md` - Name generation prompt
- `judge-names.md` - Evaluation prompt

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── types.ts            # TypeScript types
├── generator.ts        # AI name generation
├── judge.ts            # AI evaluation
├── interactive.ts      # Interactive & auto-iterate modes
├── openrouter.ts       # OpenRouter API client
├── profiles.ts         # Checker profile loader
└── checkers/           # Platform checkers
    ├── npm.ts, pypi.ts, github.ts, ...

config/
└── profiles.yaml       # Checker profiles

prompts/
├── generate-names.md   # Generation prompt
└── judge-names.md      # Judging prompt
```

## License

MIT
