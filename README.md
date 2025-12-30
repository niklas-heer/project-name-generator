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
# Find 5 quality names in one command (recommended)
bun run src/cli.ts find "A CLI task runner for automating dev workflows" -n 5 -p minimal

# Or step-by-step:
# Generate name candidates with AI
bun run src/cli.ts generate "A CLI task runner" -n 10

# Judge candidates with a critical AI reviewer
bun run src/cli.ts judge "A CLI task runner" blitz flux rayo takt kura

# Check a specific name across all platforms
bun run src/cli.ts check myproject
```

## Commands

### `find` - One-Step Name Discovery (Recommended)

Find quality project names in a single command. Automatically generates, checks availability, and judges candidates until it finds the number you need.

```bash
bun run src/cli.ts find <description> [options]

Options:
  -n, --count <number>         Number of quality candidates to find (default: 5)
  -b, --batch <number>         Names to generate per iteration (default: 15)
  -t, --threshold <percent>    Availability threshold % (default: 80)
  --min-score <score>          Minimum judge score 1-5 (default: 3.5)
  --verdict <types>            Accepted verdicts (default: strong,consider)
  --max-iterations <n>         Safety limit (default: 10)
  -m, --model <model>          Generator model
  --judge-model <model>        Judge model
  -p, --profile <name>         Checker profile
  -s, --style <style>          Name style: short, word, compound, all
  --project <tag>              Project tag for database tracking (enables persistence)
  -o, --output <file>          Write markdown report to file
  -j, --json                   Output as JSON
```

**Examples:**

```bash
# Find 5 quality names for a Python project (with database tracking)
bun run src/cli.ts find "A Python-to-binary compiler with 6ms startup" -n 5 -p python --project mycompiler

# Continue searching - automatically excludes previously generated names
bun run src/cli.ts find "A Python-to-binary compiler" -n 3 --project mycompiler

# Only accept strong verdicts with score >= 4.0
bun run src/cli.ts find "A fast web framework" --min-score 4.0 --verdict strong

# Save report to file
bun run src/cli.ts find "A CLI task runner" -n 3 -o report.md
```

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

### `projects` - List Tracked Projects

View all projects you've been tracking in the database.

```bash
bun run src/cli.ts projects
```

### `leaderboard` - View Top Candidates

Show the best name candidates for a tracked project.

```bash
bun run src/cli.ts leaderboard <project> [options]

Options:
  -n, --limit <number>    Number of results (default: 10)
  --min-score <score>     Minimum score filter
  --verdict <types>       Filter by verdict (default: strong,consider)
  -j, --json              Output as JSON
```

**Examples:**

```bash
# Show top 10 candidates for a project
bun run src/cli.ts leaderboard mycompiler

# Show only strong candidates
bun run src/cli.ts leaderboard mycompiler --verdict strong

# Export as JSON
bun run src/cli.ts leaderboard mycompiler --json
```

### `delete-project` - Remove a Project

Delete a project and all its tracked names from the database.

```bash
bun run src/cli.ts delete-project <project>
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

**Recommended: Use `find` with project tracking**

```bash
# Start searching for names (tracked in database)
bun run src/cli.ts find "A Python-to-binary compiler with 6ms startup" \
  -n 5 -p python --project mycompiler

# Continue the search later - automatically excludes previous names
bun run src/cli.ts find "A Python-to-binary compiler" -n 3 --project mycompiler

# View all candidates across sessions
bun run src/cli.ts leaderboard mycompiler

# Check the winner in full detail
bun run src/cli.ts check kest
```

**Alternative: One-off search without tracking**

```bash
# Find names without database tracking
bun run src/cli.ts find "A CLI task runner" -n 5 -o report.md
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

Models are configured in `config/models.yaml`. Current frontier models include:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-5.2-chat` (default generate), `gpt-5.2-pro`, `o3`, `o4-mini` |
| Anthropic | `claude-opus-4.5`, `claude-sonnet-4.5`, `claude-haiku-4.5` |
| Google | `gemini-3-pro` (default judge), `gemini-3-flash`, `gemini-2.5-pro` |
| Kimi | `kimi-k2-thinking`, `kimi-k2` |

Run `bun run src/cli.ts models` to see all available models.

### Temperature Settings

Temperature is configured per task type in `config/models.yaml`:

```yaml
temperature:
  generate: 1.0      # Maximum creativity for brainstorming
  refine: 0.6        # When using --exclude (variation generation)
  judge: 0.3         # Analytical evaluation
```

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

### AI Models

Configure models in `config/models.yaml`:

```yaml
models:
  gpt-5.2-chat:
    id: "openai/gpt-5.2-chat"
    description: "GPT-5.2 Chat - latest frontier"

defaults:
  generate: "gpt-5.2-chat"
  judge: "gemini-3-pro"

temperature:
  generate: 1.0
  refine: 0.6
  judge: 0.3
```

### Prompts

Customize AI prompts in `prompts/`:
- `generate-names.md` - Name generation prompt
- `judge-names.md` - Evaluation prompt

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── find.ts             # One-step name discovery pipeline
├── db.ts               # SQLite database for tracking projects
├── generator.ts        # AI name generation
├── judge.ts            # AI evaluation
├── interactive.ts      # Interactive & auto-iterate modes
├── openrouter.ts       # OpenRouter API client
├── profiles.ts         # Checker profile loader
├── types.ts            # TypeScript types
└── checkers/           # Platform checkers
    ├── npm.ts, pypi.ts, github.ts, ...

config/
├── profiles.yaml       # Checker profiles
└── models.yaml         # AI models and temperature settings

prompts/
├── generate-names.md   # Generation prompt
└── judge-names.md      # Judging prompt
```

## License

MIT
