# Project Name Generator - Justfile
# Run `just` to see available commands

# Default: show help
default:
    @just --list

# Check a name across all platforms
check name:
    bun run src/cli.ts "{{ name }}"

# Check a name and output as JSON
check-json name:
    bun run src/cli.ts "{{ name }}" --json

# Check a name (packages only, skip trademarks)
check-quick name:
    bun run src/cli.ts "{{ name }}" --skip uspto,google-software,google-opensource,fossmarks

# List all available checkers
list:
    bun run src/cli.ts list

# Run TypeScript type checking
typecheck:
    bun run typecheck

# Build a standalone binary
build:
    bun build src/cli.ts --compile --outfile checkname

# Install dependencies
install:
    bun install

# Run with a test name
test:
    bun run src/cli.ts "testproject123"

# Check multiple names (space-separated, outputs JSON)
check-batch +names:
    #!/usr/bin/env bash
    for name in {{ names }}; do
        echo "Checking: $name"
        bun run src/cli.ts "$name" --json
        echo "---"
    done

# Generate name candidates
generate description:
    bun run src/cli.ts generate "{{ description }}"

# Generate names with a specific model
generate-with-model description model:
    bun run src/cli.ts generate "{{ description }}" -m {{ model }}

# Generate names and check availability
generate-and-check description:
    bun run src/cli.ts generate "{{ description }}" -n 10 --check

# Interactive name generation with feedback loop
generate-interactive description:
    bun run src/cli.ts generate "{{ description }}" --interactive

# Generate until N available names are found (default: 5 names with 70% availability)
generate-until description count="5":
    bun run src/cli.ts generate "{{ description }}" -u {{ count }} -t 70

# Fast generation with minimal checks (npm, pypi, domain-dev only)
generate-fast description count="5":
    bun run src/cli.ts generate "{{ description }}" -u {{ count }} -p minimal -t 80

# Generate for Node.js projects
generate-node description count="5":
    bun run src/cli.ts generate "{{ description }}" -u {{ count }} -p node -t 70

# Generate for Python projects
generate-python description count="5":
    bun run src/cli.ts generate "{{ description }}" -u {{ count }} -p python -t 70

# List available AI models
models:
    bun run src/cli.ts models

# List available checker profiles
profiles:
    bun run src/cli.ts profiles
