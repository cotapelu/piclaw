# 📦 NPM Publishing Guide for Piclaw

## Overview

This guide covers publishing Piclaw and its extensions to the npm registry.

## Prerequisites

1. **npm Account**: Create at [npmjs.com](https://www.npmjs.com/)
2. **Login**: `npm login`
3. **Permissions**: Maintainer access to packages

---

## 📦 Publishing Piclaw Core

### 1. Version Bumping

Check current version:
```bash
cat package.json | grep version
```

Update version (choose one):

```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)
npm version minor

# Major release (breaking changes)
npm version major
```

This updates:
- `package.json`
- Creates git tag
- Commits changes

### 2. Build Distribution

```bash
# Clean build
npm run clean
npm run build

# Verify build
ls -la dist/
```

### 3. Test Before Publishing

```bash
# Run all tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

### 4. Publish to npm

```bash
# Login (if not already)
npm login

# Publish
npm publish

# Publish with public access (for scoped packages)
npm publish --access public
```

### 5. Verify Publication

```bash
# Check package exists
npm view @mariozechner/pi-coding-agent version

# Test install in temp directory
mkdir /tmp/test-piclaw
cd /tmp/test-piclaw
npm install @mariozechner/pi-coding-agent
```

### 6. Git Push

```bash
# Push version bump and tag
git push origin main --tags
```

---

## 🎨 Publishing Piclaw Themes

### Create Theme Package

```bash
mkdir piclaw-theme-dark
cd piclaw-theme-dark
npm init
```

**package.json**:
```json
{
  "name": "piclaw-theme-dark",
  "version": "1.0.0",
  "type": "module",
  "description": "Dark theme for Piclaw",
  "main": "theme.js",
  "keywords": ["piclaw", "theme"],
  "author": "Your Name",
  "license": "Apache-2.0"
}
```

**theme.js**:
```javascript
export default {
  name: "Dark Theme",
  colors: {
    background: "#1a1a2e",
    foreground: "#e6e6e6",
    primary: "#00d4aa",
    secondary: "#ff6b6b",
    border: "#2d2d44",
    dim: "#666666",
    accent: "#ffd93d"
  }
};
```

### Publish

```bash
npm publish
```

### Usage

```bash
# Install
pi install npm:piclaw-theme-dark

# Select in Piclaw
/settings → Theme → Dark Theme
```

---

## 🛠 Publishing Piclaw Extensions

### Extension Package Structure

```
my-piclaw-extension/
├── src/
│   └── index.ts        # Main extension
├── package.json
├── tsconfig.json
└── README.md
```

**package.json**:
```json
{
  "name": "my-piclaw-extension",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "keywords": ["piclaw", "extension"],
  "author": "Your Name",
  "license": "Apache-2.0",
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "^0.73.0"
  }
}
```

**src/index.ts**:
```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (api: ExtensionAPI) {
  api.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      await ctx.sendMessage({
        customType: "hello",
        content: "Hello from extension!",
      });
    },
  });
}
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Build Extension

```bash
npm run build
```

### Test Extension Locally

```bash
# Link for testing
npm link

# In Piclaw directory
npm link my-piclaw-extension

# Or install from local path
pi install /path/to/my-piclaw-extension
```

### Publish Extension

```bash
npm login
npm publish --access public
```

The `--access public` is required for scoped packages.

### Using Published Extension

```bash
# Install
pi install npm:my-piclaw-extension

# Use command
/hello
```

---

## 🎓 Publishing Skills

Skills are markdown files bundled in npm packages.

### Skill Package Structure

```
my-piclaw-skills/
├── skills/
│   ├── DEPLOY.md
│   └── REVIEW.md
├── package.json
└── README.md
```

**package.json**:
```json
{
  "name": "my-piclaw-skills",
  "version": "1.0.0",
  "keywords": ["piclaw", "skills"],
  "files": ["skills/**/*"],
  "license": "Apache-2.0"
}
```

**skills/DEPLOY.md**:
```markdown
# Deploy Application

Use for deployments.

## Steps
1. Run tests
2. Build
3. Deploy
```

### Publish Skills

```bash
npm publish
```

### Install Skills

```bash
pi install npm:my-piclaw-skills
```

Piclaw auto-discovers skills in installed packages.

---

## 🎨 Publishing Prompt Templates

Similar to skills, prompt templates are markdown files.

### Template Package

```
my-piclaw-prompts/
├── prompts/
│   ├── review.md
│   └── refactor.md
├── package.json
└── README.md
```

**package.json**:
```json
{
  "name": "my-piclaw-prompts",
  "version": "1.0.0",
  "keywords": ["piclaw", "prompts"],
  "files": ["prompts/**/*"],
  "license": "Apache-2.0"
}
```

Publish and install same as skills.

---

## 🔄 Version Management

### Semantic Versioning

- **Patch (1.0.X)**: Bug fixes, no new features
- **Minor (1.X.0)**: New features, backwards compatible
- **Major (X.0.0)**: Breaking changes

### Pre-release Versions

```bash
# Alpha
npm version prerelease --preid=alpha

# Beta
npm version prerelease --preid=beta

# Publish pre-release
npm publish --tag beta

# Install pre-release
pi install npm:my-extension@beta
```

### Deprecating Versions

```bash
npm deprecate my-package "Use new-package instead"
```

---

## 🔒 Security Considerations

### Package Signing

Enable 2FA on npm account:
```bash
npm profile enable-2fa
```

### Token Management

Never commit `.npmrc` with tokens:
```
# .gitignore
.npmrc
```

### Audit Dependencies

```bash
npm audit
npm audit fix
```

---

## 📊 Post-Publish Checklist

- [ ] Version bumped
- [ ] Tests passing
- [ ] Build successful
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Published to npm
- [ ] Git tag pushed
- [ ] GitHub release created
- [ ] Twitter/Discord announcement
- [ ] Documentation updated

---

## 🚀 Automated Publishing with GitHub Actions

### .github/workflows/publish.yml

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test
      
      - name: Publish
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 📖 Documentation

### README Template

```markdown
# My Piclaw Extension

[![npm version](https://img.shields.io/npm/v/my-extension.svg)](https://www.npmjs.com/package/my-extension)

Description of your extension.

## Installation

```bash
pi install npm:my-extension
```

## Usage

```
/command
```

## API

See [EXTENSION_DEVELOPMENT.md](../docs/EXTENSION_DEVELOPMENT.md)

## License

Apache-2.0
```

---

## 🎯 Best Practices

1. **Semantic Versioning**: Follow SemVer strictly
2. **Changelog**: Maintain CHANGELOG.md
3. **Tests**: Include tests for all features
4. **README**: Clear documentation
5. **Keywords**: Use `piclaw`, `extension`, `skills`, etc.
6. **License**: Apache-2.0 (same as Piclaw)
7. **Examples**: Include usage examples
8. **TypeScript**: Use strict mode

---

## 🆘 Troubleshooting

### Package Not Found

```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install my-package
```

### Permission Denied

```bash
# Use --access public for scoped packages
npm publish --access public
```

### Version Conflict

```bash
# Check installed version
npm list my-package

# Force install specific version
npm install my-package@1.0.0
```

---

## 🌐 Resources

- [npm Docs](https://docs.npmjs.com/)
- [Piclaw Examples](https://github.com/badlogic/pi-mono/tree/main/llm-context/packages/coding-agent/examples/extensions)
- [Discord Community](https://discord.com/invite/3cU7Bz4UPx)

---

*Last updated: 2026-05-06*
