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
- **607 unit tests passing (100%)**
- Build passes with 0 TypeScript errors
- Structured logging with levels and JSON format
- Comprehensive coverage of package manager, CLI commands, logging, team systems, and extension tools
- Statement coverage: 80.46%, Lines coverage: 81.58% (target ≥80% achieved)

### Known Limitations (resolved)
- ✅ `update` command implemented
- ✅ Package filtering implemented
- ✅ Health, pin, import/export implemented
- ✅ Global install uses correct agent directory
- ✅ All 518 tests pass (team test fixes and multi-runtime refactor complete)
- ✅ Build error fix (variable shadowing) resolved
- ✅ Removed `as any` casts in core files (piclaw-core.ts, team-manager.ts)

### Areas for Improvement
- Consider using `execa` for more reliable subprocess management
- Increase test coverage to ≥85% (focus on team-manager, piclaw-package-manager, todos-tool)

## Recent Changes
- All major features implemented; 595 tests passing (100%)
- Coverage: 80.28% statements, 81.43% lines (target achieved)
- Type safety improvements: removed `as any` casts in core files
- Custom .piclaw storage, full package manager (install, remove, update, info, health, pin, import, export)
- Git & npm support with retry logic, filtering, validation
- Structured logging with levels & JSON
- Team orchestration with non-blocking execution
- **Package-manager error tests**: 9 new tests covering error paths in npm/git operations, validateParsed, settings edge cases
- **Bug fix**: getConfiguredEntries now safely handles null entries in settings files
- **Team test expansion**: behavior, backoff, and integration tests
- Updated documentation and evolution logs

## Next Steps
- Increase test coverage to ≥85% by adding tests for team-manager edge cases and piclaw-package-manager internal methods
- Evaluate `execa` for subprocess management improvements
- Consider performance optimizations for large team orchestrations
- Explore adding more deterministic error handling in team loops
