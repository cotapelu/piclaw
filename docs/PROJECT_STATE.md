# Piclaw Project State

## Last Updated
2026-06-03

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
- **838 unit tests passing (100%)
- Build passes with 0 TypeScript errors
- Structured logging with levels and JSON format
- Comprehensive coverage of package manager, CLI commands, logging, team systems, and extension tools
- Statement coverage: 85.13%, Lines coverage: 86% (target ≥85% achieved)

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

**2025-06-02 - P1-001: Ctrl+R Binding**
- Added keybinding override for session selector (Ctrl+R)
- Applied only if user hasn't set custom binding
- Low-risk UX improvement

**2025-06-02 - P0 Features Complete**
- Session Management: `--session`, `--resume`, `--continue`, `--fork` flags
- Model Scoping: pattern matching, Ctrl+P cycling, 50-item limit
- @file Support: text + images + stdin
- Multi-mode: print/json/rpc with stdout takeover
- Build: TypeScript + custom models auto-generation

**2025-06-02 - P1-002: Unit Test Suite & Bug Fixes**
- Comprehensive unit tests added for all new P0 modules:
  - output-guard (6 tests)
  - prompt utilities (12 tests)
  - file-processor (22 tests)
  - model-scoper (20 tests)
  - session-resolver (19 tests)
- Fixed file-processor: proper path resolution for @file with absolute/relative paths
- Enhanced model-scoper: pattern matching supports colon (provider:model) and thinking level suffixes
- Fixed session-resolver: removed unnecessary file existence check
- Refactored prompt.ts to ESM imports for testability
- Updated main.test.ts mock to match new runtime.session.sessionManager shape
- All 689 tests passing (79 new tests)

**2025-06-02 - P1-003: Image Auto-Resize**
- Implemented automatic image resizing for large images (>2048px) using sharp
- Integrated into buildInitialMessage(); preserves aspect ratio, reduces token usage
- Added 2 new tests for resize behavior
- All 691 tests passing

---

*Previous changes (before 2025-06-02):*
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

**2025-06-02 - Settings Validation**
- Added empty pattern skip in model-scoper
- Added try-catch around resolveModelPattern for invalid patterns
- Added unit test for empty pattern warning
- Robust settings handling

**2025-06-02 - P2-001: @plan Support**
- Recognizes `@plan <file>` argument
- Reads plan file, splits into lines, ignores blanks/comments
- Expands into `--message` arguments concatenated with existing messages
- Logs number of tasks added
- Added unit test in main.test.ts\ n
**2025-06-02 - Thinking Level Precedence**
- Revised `piclaw-core.ts` to handle thinking level with clear precedence
- Order: scoped model pattern thinking → CLI `--thinking` → existing session value
- Ensures per‑session thinking level is respected and can be overridden correctly
- No regression; all 693 tests passing

**2025-06-04 - Coverage Push to ≥85%**
- Fixed model-scoper fallback: when enabled patterns yield no matches, fall back to all models instead of only default.
- Added tests for CLI args (`--contextLogFile`, `--message`) in `src/tests/cli-args.test.ts`.
- Added tests for config manager (`getAgentDir`, `getBinDir`) in `src/tests/config-manager.test.ts`.
- All tests: 838 passing, 3 skipped (100% pass).
- Coverage: 85.13% statements, 86% lines (≥85% target achieved).

## Next Steps
- Evaluate `execa` for subprocess management improvements
- Consider performance optimizations for large team orchestrations
- Explore adding more deterministic error handling in team loops

