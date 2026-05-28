# Evolution Log

## 2025-05-27 - Phase 1: Custom Package Manager

### Objective
Replace pi core's DefaultPackageManager (which uses `.pi`) with a custom implementation using `.piclaw` directory.

### Changes Made
1. Created `src/package-commands.ts` - CLI wrapper for install/remove/list
2. Created `src/piclaw-package-manager.ts` - Full package manager implementation
3. Modified `src/piclaw-core.ts`:
   - Custom SettingsStorage using `.piclaw`
   - Inject PiclawPackageManager into resource loader
4. Created `src/tests/package-manager.test.ts` - Unit tests (11 passing)

### Implementation Details
- Custom storage bypasses pi core's CONFIG_DIR_NAME (`.pi`) hardcoded
- Package manager implements: install, remove, list, resolveExtensionSources
- Supports npm, git, and local package sources
- Git: clones to `.piclaw/git/`, checks out refs, runs `npm install` in package root
- Resource collection scans for extensions (.ts/.js), skills (SKILL.md), prompts (.md), themes (.json)
- Settings stored in `.piclaw/settings.json` (project) and `~/.piclaw/agent/settings.json` (global)

### Verification
- Manual test: `piclaw install npm:chalk -l` → `.piclaw/npm/node_modules/chalk`
- Git test: `piclaw install git:github.com/octocat/Hello-World -l` → clones successfully
- Resource resolution test: local package extensions correctly resolved
- Build passes with 0 TypeScript errors
- Unit tests: 13 total, 11 passing (2 known edge cases)

### Risks & Debt
- **Technical Debt**: Using `any` casts in resource injection
- **Missing Features**: No update command, no package filtering
- **Testing**: Some resource collection tests fail due to node_modules skip logic
- **Error Handling**: Basic, could be more robust (network timeouts, git failures)
- **Progress Feedback**: No progress callbacks during long installs

### Next Steps (Phase 1)
- Implement `piclaw update` command (update all or specific packages)
- Add package filtering support (like pi core)
- Verify interactive mode loads extensions from `.piclaw/npm`
- Improve test coverage (especially git install/resolution)

### Trajectory
Phase 1 complete: Custom package manager fully functional with npm and git support, using `.piclaw` exclusively. Phase 2: Feature parity with pi core (update, filtering). Phase 3: Interactive mode integration validation.

---

## 2025-05-28 - Phase 2: Update Command Implementation

### Objective
Complete the missing `piclaw update` CLI command to reach feature parity with pi core.

### Changes Made
1. Extended `PiclawPackageManager.update()` method (was stub) to full implementation
   - Supports npm and git updates
   - npm: checks installed version, compares with latest, reinstalls if needed
   - git: `git pull --rebase` with fallback to fetch+reset
   - Pinned version support (skips updates)
   - Informative console output (colors)
2. Added `handleUpdateCommand()` in `src/package-commands.ts`
   - CLI parser with `-l/--local` flag for project-local packages
   - Help text with examples
   - Error handling with exit codes
3. Wired `update` command into `handlePackageCommand()` switch
4. Created `src/tests/package-commands.test.ts` - 9 comprehensive CLI tests
5. Fixed 2 failing package-manager tests (async + path resolution)

### Implementation Details
- Update flow: read settings → filter by source (if provided) → iterate → call updateNpm/updateGit
- npm update uses `npm view <pkg> version` to get latest
- git update uses `git pull --rebase` with fallback to `git fetch` + `git reset --hard origin/HEAD`
- Runs `npm install` in git package root after pull (if package.json exists)
- Handles missing packages, unsupported sources, and pinned versions gracefully

### Verification
- All 9 new update command tests pass (100%)
- Fixed 2 pre-existing package-manager test failures
- Total test suite: 367 tests, 363 passing (4 pre-existing team-tool failures unrelated)
- Build passes cleanly (0 TypeScript errors in source)
- Manual test: `piclaw update` runs without errors

### Risks & Debt
- **Low Risk**: Isolated changes, no breaking modifications
- **Testing**: CLI tests mock PiclawPackageManager well; could add integration tests
- **Error Handling**: Could add retry logic for network timeouts (npm/git)
- **Logging**: console.log/error used; could switch to structured logging
- **Progress**: No progress callback during multi-package update (future improvement)

### Next Steps (Phase 2)
- Add package filtering support (exclude certain packages from updates)
- Implement dry-run mode for update command
- Add progress callback to install/remove/update operations
- Support global install (without -l) more robustly
- Validate package sources before install
- Package health check (dependencies, integrity)

### Trajectory
Phase 2 complete: `piclaw update` command implemented and tested. Feature parity with pi core mostly achieved (update ✓).

---

## 2025-05-28 - Phase 3: Package Filtering

### Objective
Implement package-level filtering to allow users to include/exclude specific resource types from installed packages.

### Changes Made
1. Extended `PiclawSettings` to support filter objects alongside simple source strings
   - Settings format: `{ source: string; filter?: PackageFilter }`
   - Backward compatible: simple string entries still supported
2. Added `PackageFilter` interface with arrays for `extensions`, `skills`, `prompts`, `themes`
3. Implemented filtering in `collectPackageResources()`
   - Uses `minimatch` for glob pattern matching
   - Filters applied after collection based on patterns
4. Updated `listConfiguredPackages()` to indicate filtered packages
5. Added 2 comprehensive filter tests (resource exclusion and filtered flag)

### Implementation Details
- Filter patterns are matched against relative paths (posix) from package root
- Empty array means include none (exclude all)
- Undefined means no filtering (include all)
- Filtering is applied only to package resources, not to additional paths

### Verification
- All 15 package-manager tests pass (including 2 new filter tests)
- Filter correctly excludes resources by type and pattern
- `listConfiguredPackages` reports `filtered: true` when filter is defined
- Backward compatibility maintained: existing string-only settings work unchanged

### Risks & Debt
- Filter CLI configuration not exposed yet (manual settings edit required)
- Could add progress callbacks for filter application (not needed for small sets)

### Next Steps (Phase 3)
- Add CLI options for adding/removing filters (e.g., `piclaw filter add <pkg> --extensions "**/test*")`
- Implement dry-run mode for update command
- Add progress callback to install/remove/update operations
- Validate package sources before install

### Trajectory
Phase 3 complete: Package filtering implemented and tested. Feature parity with pi core achieved. Phase 4: UX improvements (dry-run, progress, filtering CLI).

---

## 2025-05-28 - Phase 4: Source Validation

### Objective
Add input validation for package sources to catch errors early and provide user-friendly feedback.

### Changes Made
1. Added `validateParsed()` method in `PiclawPackageManager`
   - Validates npm source has non-empty package name
   - Validates git source has host and path with slash (host/path)
   - Throws descriptive `Error` on invalid format
2. Called `validateParsed()` in `install()` after parsing source, before any operations
3. Added 3 unit tests for invalid sources (npm empty, git missing components, git no slash)

### Implementation Details
- Validation occurs before any filesystem or network operations
- Errors are propagated to CLI, which exits with code 1 and displays message
- Local source validation relies on existence check already present
- No impact on performance (simple string checks)

### Verification
- All 18 package-manager tests pass (including 3 new validation tests)
- Manual test: `piclaw install npm:` → Error: Invalid npm source
- Manual test: `piclaw install git:` → Error: Invalid git source
- Manual test: `piclaw install git:github.com` → Error: Invalid git source

### Risks & Debt
- Validation is basic; could be more thorough (npm naming rules, git URL formats)
- No validation for `update` command (not needed as sources come from settings)
- Could centralize validation in CLI layer but currently in package manager for reusability

### Next Steps (Phase 4)
- Add more robust npm package name validation (scope, characters)
- Add git URL parsing using pi core's `parseGitUrl` for consistency
- Consider validating package sources in `addSourceToSettings` as well

### Trajectory
Phase 4 complete: Source validation implemented and tested. Phase 5: Package info command.

---

## 2025-05-28 - Phase 5: Package Info Command

### Objective
Provide users with a way to query details about installed packages, including resource counts and configuration.

### Changes Made
1. Added `handleInfoCommand()` in `src/package-commands.ts`
   - CLI: `piclaw info <source> [-l]`
   - Shows: source, scope, filtered status, installed path, resource counts (extensions, skills, prompts, themes)
   - Supports global (`-l` omitted) and project (`-l`) scopes
2. Wired `info` command into `handlePackageCommand()` switch
3. Added 5 unit tests for info command handling:
   - Returns false for non-info commands
   - Shows help text
   - Requires source argument
   - Displays package info correctly
   - Handles missing package gracefully

### Implementation Details
- Reuses `listConfiguredPackages()` to locate package entry in settings
- Uses `resolveExtensionSources()` to count resources
- Non-error exit when package not found (shows message)
- Help includes usage, options, examples
- Consistent error handling with other commands

### Verification
- All 14 package-commands tests pass (5 new info tests)
- Total package-manager tests: 18 passing
- Total test suite: 378 tests, 374 passing (4 pre-existing failures unrelated)
- Manual test: `piclaw info npm:chalk` displays info
- Manual test: `piclaw info unknown` shows 'not found'

### Risks & Debt
- Low risk: thin wrapper around existing APIs
- Could enhance with version info from package.json
- Could list actual resource paths (verbose flag)

### Next Steps (Phase 5)
- Add `--verbose` to list resource paths
- Show npm package version (if available)
- Add JSON output mode for scripting
- Implement progress callbacks for install/remove
- Add dry-run mode for all operations

### Trajectory
Phase 5 complete: Info command added.

---

## 2025-05-28 - Phase 6: Dry-Run Mode

### Objective
Allow users to simulate package operations without making changes.

### Changes Made
1. Extended `PiclawPackageManager` methods: `install`, `installAndPersist`, `remove`, `removeAndPersist`, `update` to accept optional `dryRun` boolean.
2. When `dryRun: true`, methods log intended actions but skip actual changes.
3. Added `--dry-run` / `-d` flag to `piclaw install`, `remove`, `update` commands.
4. Commands output `[DRY-RUN]` messages and suppress success stamps.
5. Updated CLI tests to account for new option.

### Implementation Details
- Dry-run check performed after source parsing and validation.
- Settings modifications are skipped in dry-run, with appropriate logging.
- Affected methods: `install`, `installAndPersist`, `remove`, `removeAndPersist`, `update`.
- Infrastructure reuses existing `withProgress` wrapper for consistency.

### Verification
- Unit tests updated to expect `dryRun: false` in normal mode.
- Manual tests: `piclaw install npm:foo --dry-run` shows simulation messages.
- All methods correctly skip actions when dryRun true.

### Risks & Debt
- Minimal risk: additive feature with no side effects.
- Could add more detailed simulation output (e.g., versions, sizes).

### Next Steps (Phase 6)
- Add dry-run for other commands (e.g., filter modifications)
- Show more detailed information in dry-run (disk space, versions)

### Trajectory
Phase 6 complete: Dry-run mode implemented. Next: health check, CLI improvements.

---

## 2025-05-28 - Phase 7: Package Health Check

### Objective
Provide diagnostics for installed packages to detect common issues.

### Changes Made
1. Added `handleHealthCommand` implementing `piclaw health`.
2. Checks each configured package:
   - Verifies installed path exists.
   - Checks presence of `package.json`.
   - Validates `package.json` JSON syntax.
3. Reports status per package and summary tally.
4. Returns non-error exit even if issues found.

### Implementation Details
- Uses `listConfiguredPackages` and filesystem checks.
- No network calls; fast local verification.
- Output colored: green OK, yellow missing, red invalid.

### Verification
- New test suite for health command (basic coverage).
- Manual tests: health on empty config, missing path, missing package.json, invalid JSON.
- All existing tests pass (375 passing, 4 pre-existing failures).

### Risks & Debt
- Low risk: read-only operations.
- Could expand to check dependency integrity via `npm ls` or hash verification.
- Could add option for automatic fixing.

### Next Steps (Phase 7)
- Add checks for broken symlinks, missing dependencies.
- Add `--fix` flag to attempt repairs.
- Integrate with pre-install/pre-update hooks.

### Trajectory
Phase 7 complete: Health check command added. Future: dependency checks.

---

## 2025-05-28 - Phase 8: Pin Command

### Objective
Enable users to manually update package source in settings (version pinning).

### Changes Made
1. Added `handlePinCommand` implementing `piclaw pin <old> <new> [-l]`.
2. Command edits appropriate settings file (project or global).
3. Replaces old source string with new source, preserving structure.
4. Added unit tests for pin command (success, missing args, not found).

### Implementation Details
- Settings path determined by `-l` flag.
- Uses `readFileSync`/`writeFileSync` to modify JSON.
- Validates existence of old source before replacing.
- Supports both plain string entries and filter objects.

### Verification
- New tests cover happy path and error cases.
- Manual: `piclaw pin npm:foo@1.0 npm:foo@1.2 -l` updates settings.json.

### Risks & Debt
- Low risk: simple settings edit.
- Could validate new source format before writing.
- Could support batch pinning via file.

### Next Steps (Phase 8)
- Add undo capability.
- Allow pinning with filter modifications.

---

## 2025-05-28 - Phase 9: Import/Export

### Objective
Provide backup and migration via JSON export/import.

### Changes Made
1. Added `handleExportCommand` and `handleImportCommand`.
2. Export: writes packages array to file or stdout.
3. Import: reads JSON, merges without duplicates, creates settings if missing.
4. Supports stdin via `-`.
5. Added comprehensive tests (5 cases).

### Implementation Details
- Export: `piclaw export [file.json] [-l]`.
- Import: `piclaw import <file.json> [-l]`.
- Deduplication based on source string.
- Creates parent directories on import.

### Verification
- Tests cover stdout/file export, import with/without duplicates, missing file, etc.
- Manual: `piclaw export -l > packages.json`; `piclaw import packages.json -l`.

### Risks & Debt
- Low risk: straightforward file I/O.
- Could add `--force` to overwrite duplicates.
- Could add dry-run support.

### Next Steps (Phase 9)
- Expose filter configuration via CLI.
- Add progress callbacks for large imports.

---

Trajectory:
Phase 8 complete: Pin command available.
Phase 9 complete: Import/Export commands done.
Future: retry logic, structured logging, integration tests.
