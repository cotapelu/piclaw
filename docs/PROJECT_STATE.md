# Piclaw Project State

## Last Updated
2025-05-30

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
- **510 unit tests passing (100%)**
- Build passes with 0 TypeScript errors
- Structured logging with levels and JSON format
- Comprehensive coverage of package manager, CLI commands, logging, and team systems

### Known Limitations (resolved)
- ✅ `update` command implemented
- ✅ Package filtering implemented
- ✅ Health, pin, import/export implemented
- ✅ Global install uses correct agent directory
- ✅ All 510 tests pass (team test fixes and multi-runtime refactor complete)
- ✅ Build error fix (variable shadowing) resolved

### Areas for Improvement
- Replace remaining `any` casts with proper TypeScript interfaces
- Consider using `execa` for more reliable subprocess management
- Increase test coverage beyond 75%

## Recent Changes
- Fixed shadowed variable in `piclaw-core.ts` causing build error
- Team test fixes: shared session manager and cwd propagation
- Multi-runtime test refactor: use injection pattern via `createRuntime` option
- Evolution metrics updated to reflect 510 passing tests
- Updated AGENT_PROFILE.md and EVOLUTION.md accordingly

## Next Steps
See TODO.md for full task list.
