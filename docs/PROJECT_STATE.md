# Piclaw Project State

## Last Updated
2025-05-27

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
- Resource resolution: Discovers extensions, skills, prompts, themes from installed packages
- Git support: Clones repos, checks out refs, runs `npm install` in package root

### Known Limitations
- No `update` command yet
- No package filtering support (like pi core)
- Global install (without -l) may conflict with system npm locations
- Resource collection skips `node_modules` subdirectories

## Recent Changes
- Implemented full git package source support (clone, checkout, resolve)
- Rewrote package-commands.ts to use PiclawPackageManager directly
- Added unit tests for package manager (11 passing)

## Next Steps
See TODO.md for full task list.
