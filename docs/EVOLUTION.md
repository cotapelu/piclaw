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

### Implementation Details
- Custom storage bypasses pi core's CONFIG_DIR_NAME (`.pi`) hardcoded
- Package manager implements essential methods: install, remove, list, resolveExtensionSources
- Resource collection scans installed packages for extensions, skills, prompts, themes
- Settings stored in `.piclaw/settings.json` (project) and `~/.piclaw/agent/settings.json` (global)

### Verification
- Manual test: `piclaw install npm:chalk -l` → `.piclaw/npm/node_modules/chalk`
- Resource resolution test: local package with extension file correctly resolved
- Build passes with 0 TypeScript errors

### Risks & Debt
- **Technical Debt**: Using `any` casts to bypass private constructors
- **Missing Features**: Git source support incomplete, no update command
- **Testing**: No unit tests, relies on manual verification
- **Error Handling**: Basic, could be more robust

### Next Steps
- Write unit tests for PiclawPackageManager
- Implement git package fully (clone, checkout, update)
- Add `piclaw update` command
- Verify interactive mode loads extensions from `.piclaw/npm`

### Trajectory
Moving from basic package management to full replacement of pi core's package system. Goal: make piclaw fully independent with `.piclaw` as sole config directory.
