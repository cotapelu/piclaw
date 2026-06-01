# Piclaw Project State

## Last Updated
2025-06-01

## Current Architecture

### Core Components
- **piclaw-core.ts**: Bootstraps agent runtime with custom `.piclaw` storage
- **package-commands.ts**: CLI commands for package management
- **piclaw-package-manager.ts**: Custom package manager using `.piclaw`

### Configuration
- Project settings: `.piclaw/settings.json`
- Global settings: `~/.piclaw/agent/settings.json`
- Package install root:
  - NPM: `.piclaw/npm/node_modules/`
  - Git: `.piclaw/git/`
- Packages stored as source strings (e.g., `npm:chalk`, `git:github.com/user/repo`)

### Package Manager Features
- `install <source> [-l]`: Install npm, git, or local packages
- `remove <source> [-l]`: Remove packages
- `list`: List installed packages with scopes and paths
- `info <source>`: Show package details and resource counts
- `update [source] [-l]`: Update packages with npm/git version checking
- `health`: Verify installation integrity
- `pin <old> <new>`: Update package source in settings
- `export [file]` / `import <file>`: Backup/restore packages
- `--filter` support for pattern-based resource inclusion during install
- Dry-run mode (`-d/--dry-run`) for safe simulation
- Resource resolution: Discovers extensions, skills, prompts, themes from installed packages
- Git support: Clones repos, checks out refs, runs `npm install` in package root
- Retry logic with exponential backoff for network failures

### Team Feature
- Agent team orchestration with shared services and isolated runtimes
- Multi-agent collaboration via `team_run`
- Proper session management and event forwarding

### Testing & Quality
- **565 unit tests passing (100%)**
- Build passes with 0 TypeScript errors
- Structured logging with levels and JSON format
- Comprehensive coverage of package manager, CLI commands, logging, team systems, and extension tools
- Statement coverage: 80.03% (target achieved)

### Known Limitations (resolved)
- ✅ `update` command implemented
- ✅ Package filtering implemented
- ✅ Health, pin, import/export implemented
- ✅ Global install uses correct agent directory
- ✅ All 518 tests pass (team test fixes and multi-runtime refactor complete)
- ✅ Build error fix (variable shadowing) resolved

### Areas for Improvement
- ✅ Replace remaining `any` casts in `piclaw-core.ts` and `team-manager.ts` (completed)
- Consider using `execa` for more reliable subprocess management
- Increase test coverage to ≥85% (for critical modules)

## Recent Changes
- Added comprehensive test suite for `skill-reader` module:
  - Unit tests for `read-skill.ts` command module (11 passing)
  - Integration tests for `skill-reader.ts` tool wrapper (5 passing)
- Added unit tests for `auto-compact-85.ts` hook (4 passing)
- Added test coverage for `tool-template.ts` basics (6 passing) covering tool definition, command metadata, and error handling
- Increased overall test coverage to 80.03% statements (from ~75%)
- All 565 tests passing (added 32 new tests)
- Updated metrics in AGENT_METRICS.md and EVOLUTION.md
- Updated TODO.md with coverage achievement

## Next Steps
- Increase test coverage to ≥85% (focus on team-manager, piclaw-package-manager, todos-tool)
- Evaluate `execa` for subprocess management improvements
- Consider performance optimizations for large team orchestrations
- Explore adding more deterministic error handling in team loops
