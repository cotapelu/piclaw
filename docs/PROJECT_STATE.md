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
- Package install root: `.piclaw/npm/`
- Git packages: `.piclaw/git/`

### Package Manager Features
- `install <source> [-l]`: Install npm/local packages
- `remove <source> [-l]`: Remove packages
- `list`: List installed packages
- Resource resolution: extensions, skills, prompts, themes

### Known Limitations
- Git sources not fully implemented (install works, but resolve may not)
- No update command yet
- No package filtering support
- Global install (without -l) may conflict with system npm

## Recent Changes
- Replaced pi core's DefaultPackageManager with PiclawPackageManager
- Custom SettingsStorage to use `.piclaw` instead of `.pi`
- Integrated package manager into runtime via resourceLoaderOptions

## Next Steps
See TODO.md for full task list.
