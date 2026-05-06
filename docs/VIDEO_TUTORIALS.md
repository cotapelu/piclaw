# 🎥 Video Tutorials for Piclaw

This document outlines the video tutorial series for Piclaw, providing scripts, recording guidelines, and hosting information for all key features.

## 📋 Tutorial Series Overview

### Module 1: Getting Started (Beginner)
1. **Introduction to Piclaw** (5 min)
2. **Installation & Setup** (8 min)
3. **Your First Session** (10 min)
4. **Basic Commands & Navigation** (12 min)

### Module 2: Core Features (Intermediate)
5. **Understanding Context Files** (10 min)
6. **Customizing with Skills** (15 min)
7. **Using Prompt Templates** (10 min)
8. **Managing Models & Providers** (15 min)

### Module 3: Advanced Usage (Advanced)
9. **Extension Development** (25 min)
10. **Custom Tools & Commands** (20 min)
11. **Session Management & Branching** (15 min)
12. **SubTool Loader Deep Dive** (20 min)

### Module 4: Workflow Integration (Expert)
13. **CI/CD with Piclaw** (20 min)
14. **Team Collaboration** (15 min)
15. **Advanced Extension Patterns** (30 min)
16. **Troubleshooting & Debugging** (15 min)

---

## 🎬 Tutorial 1: Introduction to Piclaw

**Duration:** 5 minutes  
**Level:** Beginner  
**Objective:** Understand what Piclaw is and its key features

### Script

```
[00:00] Intro
"Hi! Welcome to Piclaw - a professional AI coding agent for your terminal."

[00:30] What is Piclaw?
"Piclaw is a terminal-based AI coding assistant that integrates powerful LLMs
with smart tools to help you write, refactor, and debug code efficiently."

[01:15] Key Features (show screenshots)
- Intelligent code assistance with Claude, GPT, and 268+ models
- 50+ built-in system tools (bash, git, docker, etc.)
- Interactive TUI with real-time streaming
- Extensible architecture with custom extensions
- Session management with branching and compaction

[02:30] How It Works
"Piclaw uses a dual dependency model:
- Runtime: pi-coding-agent (handles LLM interactions)
- Reasoning: llm-context (analyzes source code)

This separation allows Piclaw to be both powerful and extensible."

[03:45] Quick Demo (terminal recording)
$ piclaw
→ Interactive session starts
→ Type a coding question
→ See real-time streaming response
→ Use tools like read, edit, bash
→ Manage sessions with /tree

[04:30] What You'll Learn
"In this tutorial series, you'll learn to:
- Install and configure Piclaw
- Use core features and commands
- Create custom extensions
- Integrate with your workflow

Let's get started!"

[05:00] Outro
"Hit subscribe for more tutorials, and check the docs at docs/"
```

### Recording Checklist

- [ ] Record terminal at 1080p, 60fps
- [ ] Use clean terminal theme (Dracula or Solarized Dark)
- [ ] Show zoomed-in code when demonstrating
- [ ] Add cursor highlights for clarity
- [ ] Include lower-thirds for key terms
- [ ] Add captions/subtitles
- [ ] Background music (quiet, instrumental)

### Editing Notes

- Speed up terminal typing to 1.5x
- Add annotations for key UI elements
- Include chapter markers
- Add links in description

---

## 🎬 Tutorial 2: Installation & Setup

**Duration:** 8 minutes  
**Level:** Beginner  
**Objective:** Install Piclaw and configure basic settings

### Script

```
[00:00] Intro
"Welcome back! Today we'll install Piclaw and set up your first configuration."

[00:15] Prerequisites
"You'll need:
- Node.js 18+ or Bun
- npm, pnpm, or yarn
- A code editor (VS Code recommended)
- API key for your preferred LLM provider"

[01:00] Installation Methods

Method 1: NPM (show terminal)
$ npm install -g @mariozechner/pi-coding-agent

Method 2: Bun (show terminal)
$ bun install -g @mariozechner/pi-coding-agent

Method 3: Clone from source (show terminal)
$ git clone https://github.com/your-org/piclaw.git
$ cd piclaw
$ npm install
$ npm run build

[02:30] Verify Installation
$ piclaw --version
→ Should show version number

$ piclaw --help
→ Shows all available commands

[03:15] First Run
$ piclaw
→ Launches interactive mode
→ Shows configuration prompts
→ Guides through initial setup

[04:00] Configuration Files

Show ~/.piclaw/ directory structure:
~/.piclaw/
├── agent/
│   ├── config.json     ← Main config
│   ├── auth.json       ← API keys
│   ├── models.json     ← Custom models
│   ├── settings.json   ← Preferences
│   └── extensions/     ← Your extensions
└── sessions/           ← Saved sessions

[05:30] Basic Configuration

Edit ~/.piclaw/config.json:
{
  "model": "anthropic:claude-opus-4-5",
  "thinking": "medium",
  "tools": ["read", "bash", "edit", "write"],
  "verbose": false
}

[06:45] API Key Setup

For Anthropic:
$ export ANTHROPIC_API_KEY=sk-ant-...

For OpenAI:
$ export OPENAI_API_KEY=sk-...

Or use /login command in Piclaw:
/login → Select provider → Authenticate

[07:30] Test Your Setup

$ piclaw "Hello, can you help me?"
→ Should get AI response

[07:45] Troubleshooting

Common issues:
- API key not set → Check env vars
- Model not available → Check provider
- Permission denied → Check file permissions
- Network error → Check internet connection

[08:00] Outro
"You're all set! Next tutorial: Your first Piclaw session."
```

### Recording Checklist

- [ ] Show each installation method
- [ ] Highlight success/failure messages
- [ ] Demonstrate config file editing
- [ ] Show environment variable setup
- [ ] Test with actual API key
- [ ] Include error scenarios and fixes
- [ ] Add on-screen keyboard shortcuts
- [ ] Include download links in description

### B-Roll Shots

- Terminal commands
- File explorer showing config files
- API key setup pages
- Successful test output

---

## 🎬 Tutorial 3: Your First Session

**Duration:** 10 minutes  
**Level:** Beginner  
**Objective:** Run your first complete Piclaw session

### Script

```
[00:00] Intro
"Let's dive into your first Piclaw session! We'll walk through a real workflow."

[00:15] Scenario Setup

Project: A simple blog application
Task: Add user authentication
Files:
- app.py
- models.py
- requirements.txt

[00:45] Starting Piclaw

$ cd blog-app
$ piclaw --model anthropic:claude-opus-4-5 --thinking high

→ Interactive mode starts
→ Shows welcome header
→ Displays available tools

[01:30] The Editor Interface

Point out UI elements:
- Top: Session info, model, thinking level
- Middle: Chat history
- Bottom: Input editor with border
- Footer: Working directory, token usage

[02:00] Your First Prompt

Type: "Help me add user authentication to this app"
→ Shows typing indicator
→ Real-time streaming response
→ Suggests implementation steps

Show the streaming response:
```
Let's implement authentication step by step:

1. First, let's check the existing code...
```

[02:45] Using Tools

LLM suggests: "Let me read the existing files"
→ Auto-executes read tool
→ Shows file contents

LLM suggests: "Now let's edit models.py"
→ Uses edit tool
→ Shows diff

[05:00] Review & Accept Changes

Use /review to analyze code
→ Shows security issues
→ Suggests improvements

Accept changes with /accept
→ Applies to files
→ Commits to git

[06:30] Testing

"Let's test the new feature"
→ Runs pytest
→ Shows results

[07:15] Session Management

Type /session
→ Shows session stats
→ Token usage: 15K tokens
→ Duration: 8 minutes

Type /tree
→ Shows session flow
→ Can navigate branches

[08:30] Wrapping Up

Type /export
→ Exports to HTML
→ Share with team

Type /quit
→ Save session
→ Exit

[09:30] Key Takeaways

✓ Start with clear prompt
✓ Let LLM use tools
✓ Review changes
✓ Manage sessions
✓ Export results

[10:00] Outro
"You just completed your first Piclaw workflow! Practice these steps to master the tool."
```

### Recording Checklist

- [ ] Record full session from start to finish
- [ ] Show typing and thinking time
- [ ] Highlight tool execution
- [ ] Show UI transitions
- [ ] Include before/after code views
- [ ] Demonstrate session commands
- [ ] Show export functionality
- [ ] Add timestamps for key moments

### Visual Aids

- Annotations for tool calls
- Highlight code changes
- Show token counter
- Display session tree
- Export file preview

---

## 🎬 Tutorial 4: Basic Commands & Navigation

**Duration:** 12 minutes  
**Level:** Beginner  
**Objective:** Master Piclaw's core commands and shortcuts

### Script

```
[00:00] Intro
"Knowing Piclaw's commands makes you 10x more productive. Let's learn them all!"

[00:15] Command Types

1. Slash commands (/) - In-editor
2. Keyboard shortcuts - Global
3. Special prefixes - Bash commands
4. CLI flags - Startup options

[01:00] Slash Commands - Model Management

/model
→ Opens model selector
→ Shows all available models
→ Filter by provider
→ Switch with Enter

Type: /model anthropic:claude-opus-4-5
→ Immediate model switch

/scoped-models
→ Enable/disable for Ctrl+P cycling
→ Great for testing different models

[03:00] Slash Commands - Session Control

/new
→ Starts fresh session
→ Clears chat
→ Keeps settings

/resume
→ Browse previous sessions
→ Search by name
→ Resume from any point

/tree (IMPORTANT!)
→ Navigate session tree
→ See all branches
→ Jump to any point
→ Continue from there

Show complex tree navigation:
- Fork from branch point
- Merge branches
- Label important nodes

[06:00] Slash Commands - Context Management

/compact
→ Summarizes old messages
→ Frees context space
→ Keeps key information

/compact "Keep only API changes"
→ Custom instructions

/export session.html
→ Save complete session
→ Share with others
→ Re-import later

[08:00] Slash Commands - System

/settings
→ Thinking level slider
→ Theme selector
→ Tool toggles
→ Model settings

/hotkeys
→ Shows all shortcuts
→ Searchable
→ Customizable

/changelog
→ Recent updates
→ New features
→ Bug fixes

/quit
→ Clean exit
→ Save session
→ Goodbye!

[10:00] Keyboard Shortcuts

Essential shortcuts:
- Ctrl+C: Clear editor
- Ctrl+C twice: Quit
- Escape: Cancel/abort
- Ctrl+L: Model selector
- Shift+Tab: Cycle thinking
- Alt+Enter: Queue message
- Ctrl+O: Toggle tool output

[11:00] Bash Commands (! and !!)

!ls -la
→ Runs command
→ Shows output
→ Sends to LLM

!!rm -rf node_modules
→ Runs without context
→ LLM doesn't see

[11:45] CLI Startup Flags

piclaw --model openai:gpt-4o --thinking high --verbose

Common flags:
- --cwd: Working directory
- --tools: Allowlist tools
- --sessionDir: Custom sessions
- --verbose: Debug output

[12:00] Outro
"Master these commands and you'll navigate Piclaw like a pro!"
```

### Recording Checklist

- [ ] Demonstrate every command
- [ ] Show keyboard shortcuts
- [ ] Record model switching
- [ ] Show tree navigation
- [ ] Demonstrate /compact
- [ ] Record /export
- [ ] Show settings panel
- [ ] Test bash prefixes
- [ ] Highlight most useful commands
- [ ] Include cheat sheet overlay

### Cheat Sheet Overlay

Display during video:
```
MOST USEFUL COMMANDS:
/model          - Switch model
/tree           - Navigate session
/compact        - Free context
/settings       - Preferences
/export         - Save session
Ctrl+C          - Clear editor
Ctrl+C twice    - Quit
Escape          - Cancel
```

---

## 🎬 Tutorial 5: Understanding Context Files

**Duration:** 10 minutes  
**Level:** Intermediate  
**Objective:** Customize Piclaw's behavior with context files

### Script

```
[00:00] Intro
"Context files let Piclaw know how to code in YOUR way. Let's configure them!"

[00:15] What Are Context Files?

Files Piclaw reads on every session:
- AGENTS.md - Coding guidelines
- SYSTEM.md - Complete system prompt
- APPEND_SYSTEM.md - Add to system prompt

Location:
- ~/.pi/agent/ (global)
- .pi/ (project)
- Parent directories (auto-discovered)

[01:30] AGENTS.md - Best Practices

Create ~/.pi/agent/AGENTS.md:

```markdown
# My Coding Standards

## General Rules
- Write tests before code
- Use TypeScript strict mode
- Follow SOLID principles
- Comment complex logic

## Language Specific

### TypeScript
- Use interfaces, not types
- Enable all strict flags
- Prefer readonly arrays

### Python
- Follow PEP 8
- Use type hints
- Write docstrings

## Project Structure
- Keep modules small
- Use dependency injection
- Separate concerns
```

[04:00] SYSTEM.md - Complete Override

Replace default system prompt:

```markdown
You are a senior software engineer at Google.
You write clean, maintainable, tested code.
You never use console.log in production.

When given a task:
1. Understand requirements
2. Design solution
3. Write tests
4. Implement
5. Review and refactor
```

[05:30] APPEND_SYSTEM.md - Add Rules

Add to existing system prompt:

```markdown
## Project Specifics

- Use React hooks, not classes
- State management with Redux
- TypeScript always
- Jest for testing
```

[07:00] Multiple Context Files

Piclaw concatenates all found:
1. ~/.pi/agent/AGENTS.md
2. ../AGENTS.md (parent)
3. ../../AGENTS.md (grandparent)

Last found takes priority!

[08:00] Disable Context Files

piclaw --no-context-files
Or in config.json:
"noContextFiles": true

[09:00] Real Example

Show Piclaw following AGENTS.md rules:
- Auto-adds tests
- Uses correct imports
- Follows project conventions

[09:30] Best Practices

✓ Keep context files focused
✓ Update as project evolves
✓ Use project-specific files
✓ Version control with team

[10:00] Outro
"Context files make Piclaw code like YOU want. Customize them for your team!"
```

### Recording Checklist

- [ ] Create each context file
- [ ] Show Piclaw reading files
- [ ] Demonstrate rule following
- [ ] Show multiple file merging
- [ ] Test disable flag
- [ ] Include code examples
- [ ] Show best/worst practices

### Before/After Demo

Show same prompt:
- Without context files → generic code
- With context files → team-standard code

---

## 🎬 Tutorial 6: Customizing with Skills

**Duration:** 15 minutes  
**Level:** Intermediate  
**Objective:** Create and use Skills for repeatable workflows

### Script

```
[00:00] Intro
"Skills let you encapsulate complex workflows. Let's build some!"

[00:15] What Are Skills?

Markdown files that define workflows.
Piclaw suggests them when relevant.

Location:
- ~/.pi/agent/skills/
- .pi/skills/

Format: SKILL.md files

[01:30] Your First Skill

Create ~/.pi/agent/skills/deploy/DEPLOY.md:

```markdown
# Deploy to Production

Use when deploying to production server.

## Steps

1. Run tests
   ```bash
   npm test
   ```

2. Build project
   ```bash
   npm run build
   ```

3. Backup current version
   ```bash
   ./backup.sh production
   ```

4. Deploy
   ```bash
   ./deploy.sh production
   ```

5. Verify
   ```bash
   ./healthcheck.sh
   ```

## Notes

- Always backup first!
- Notify team on Slack
- Check error logs
- Have rollback plan
```

[04:00] Using Skills

Type: /skill:deploy

Piclaw:
- Recognizes skill
- Loads steps
- Guides through workflow
- Executes commands

[05:30] Parameterized Skills

Skills can have parameters!

Create ~/.pi/agent/skills/deploy/DEPLOY.md:

```markdown
# Deploy {{environment}}

Deploy to {{environment}} server.

## Steps

1. Run tests
   ```bash
   npm test
   ```

2. Build for {{environment}}
   ```bash
   npm run build:{{environment}}
   ```

3. Deploy to {{environment}}
   ```bash
   ./deploy.sh {{environment}}
   ```

## Notes

Environment: {{environment}}
Date: {{date}}
```

Use: /skill:deploy production
Piclaw replaces {{environment}} with "production"

[08:30] Auto-Suggest Skills

Piclaw suggests relevant skills:

You: "Let's deploy to staging"
Piclaw: "I can use the 'Deploy' skill. Proceed?"

Shows skill card with steps

[09:30] Complex Skill Example

Code review skill:

```markdown
# Code Review

Use for PR reviews.

## Checklist

- [ ] Tests cover new code
- [ ] No console.log
- [ ] Follows coding standards
- [ ] Documentation updated
- [ ] Performance considered

## Steps

1. Run static analysis
   ```bash
   npm run lint
   npm run typecheck
   ```

2. Run tests
   ```bash
   npm test -- --coverage
   ```

3. Check bundle size
   ```bash
   npm run analyze
   ```

4. Security scan
   ```bash
   npm audit
   ```

## Review Criteria

Rate each 1-5:
- Code quality
- Test coverage
- Documentation
- Performance
```

[12:00] Organizing Skills

Directory structure:

```
~/.pi/agent/skills/
├── deploy/
│   └── DEPLOY.md
├── review/
│   └── REVIEW.md
├── setup/
│   ├── PROJECT.md
│   └── ONBOARDING.md
└── workflow/
    └── RELEASE.md
```

[13:30] Best Practices

✓ Keep steps actionable
✓ Include actual commands
✓ Add notes and warnings
✓ Use parameters for flexibility
✓ Update as workflows change
✓ Share with team

[14:30] Outro
"Skills turn complex workflows into simple commands. Build them for your team!"
```

### Recording Checklist

- [ ] Create multiple skills
- [ ] Demonstrate /skill command
- [ ] Show parameter replacement
- [ ] Record auto-suggestions
- [ ] Execute skill steps
- [ ] Show directory structure
- [ ] Include before/after comparison
- [ ] Test complex skill

### Skill Examples to Show

1. Deploy skill (full workflow)
2. Code review skill (checklist)
3. Setup skill (onboarding)
4. Custom parameterized skill

---

## 🎬 Tutorial 7: Customizing with Prompt Templates

**Duration:** 10 minutes  
**Level:** Beginner  
**Objective:** Create reusable prompt templates

### Script

```
[00:00] Intro
"Tired of typing the same prompts? Prompt templates save you time!"

[00:15] What Are Prompt Templates?

Reusable prompts stored as files.
Expand with /name in editor.

Location:
- ~/.pi/agent/prompts/
- .pi/prompts/

Format: Markdown files

[01:00] Your First Template

Create ~/.pi/agent/prompts/review.md:

```markdown
# Code Review

Review this code for:
1. Security vulnerabilities
2. Performance issues
3. Code quality (clean code, SOLID)
4. Test coverage

## Context
{{context}}

## Focus on: {{focus}}
```

[02:30] Using Templates

In editor, type: /review

→ Template expands:
```markdown
# Code Review

Review this code for:
1. Security vulnerabilities
2. Performance issues
3. Code quality (clean code, SOLID)
4. Test coverage

## Context
{{context}}

## Focus on: {{focus}}
```

Edit parameters, press Enter to send.

[04:00] Parameterized Templates

Create ~/.pi/agent/prompts/optimize.md:

```markdown
# Performance Optimization

Optimize this code for {{metric}}:

## Code
{{code}}

## Current Issues
{{issues}}

## Target
- Improve {{metric}} by 50%
- Maintain readability
- Add tests
```

Type: /optimize
Fill in parameters
Press Enter

[06:00] Template Variables

Available variables:

{{code}} - Selected code
{{file}} - Current file
{{context}} - Context info
{{date}} - Current date
{{user}} - Your name

[07:30] Multiple Placeholders

Complex template:

```markdown
# Refactor: {{component}}

Refactor {{component}} to improve:
{{improvements}}

## Current Code
{{code}}

## Requirements
{{requirements}}

## Tests
{{tests}}
```

[09:00] Template Organization

Directory structure:

```
~/.pi/agent/prompts/
├── review/
│   ├── security.md
│   ├── performance.md
│   └── quality.md
├── refactor/
│   ├── component.md
│   └── architecture.md
├── test/
│   ├── unit.md
│   └── integration.md
└── document/
    └── api.md
```

[09:45] Best Practices

✓ Use clear placeholders
✓ Add comments in template
✓ Organize by category
✓ Include examples
✓ Keep focused scope
✓ Share with team

[10:00] Outro
"Prompt templates save hours of typing. Create them for your common tasks!"
```

### Recording Checklist

- [ ] Create multiple templates
- [ ] Demonstrate expansion
- [ ] Show parameter usage
- [ ] Test with real code
- [ ] Show organization
- [ ] Include shortcuts
- [ ] Compare before/after

### Template Examples

1. Code review template
2. Optimization template
3. Refactoring template
4. Test generation template

---

## 🎬 Tutorial 8: Model Management

**Duration:** 15 minutes  
**Level:** Intermediate  
**Objective:** Configure models and providers

### Script

```
[00:00] Intro
"Piclaw supports 268+ models. Let's configure them for YOUR needs!"

[00:15] Provider Overview

Built-in providers:
- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- Custom (your API)

268 models available via Kilo provider!

[02:00] Setting API Keys

Method 1: Environment variables

$ export ANTHROPIC_API_KEY=sk-ant-...
$ export OPENAI_API_KEY=sk-...

Method 2: /login command

/login
→ Select provider
→ Authenticate
→ Key stored securely

Method 3: Config file

~/.piclaw/auth.json:
{
  "anthropic": "sk-ant-...",
  "openai": "sk-..."
}

[04:00] Selecting Models

/model
→ Browse all models
→ Filter by provider
→ Switch instantly

/model anthropic:claude-opus-4-5
→ Direct switch

/scoped-models
→ Enable models for Ctrl+P
→ Quick cycling

[06:00] Configuring Defaults

~/.piclaw/config.json:
{
  "model": "anthropic:claude-opus-4-5",
  "thinking": "medium",
  "scopedModels": [
    {"model": "anthropic:claude-sonnet-3.5"},
    {"model": "openai:gpt-4o"}
  ]
}

[08:00] Model Capabilities

Key features to compare:
- Context window
- Reasoning support
- Tool use
- Cost
- Speed

Show comparison:

| Model | Context | Reasoning | Cost/1M |
|-------|---------|-----------|----------|
| Claude 3.5 Sonnet | 200K | ✅ | $3/$15 |
| GPT-4o | 128K | ❌ | $5/$15 |
| Claude 3 Opus | 200K | ✅ | $15/$75 |

[10:00] Custom Providers

Register custom API:

Extension code:
```typescript
api.registerProvider("my-api", {
  baseUrl: "https://api.my.com/v1",
  apiKey: "MY_API_KEY",
  api: "openai-chat-completions",
  models: [
    {
      id: "my-model",
      name: "My Model",
      reasoning: false,
      input: ["text"],
      cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 16384,
      maxTokens: 8192,
    },
  ],
});
```

[13:00] models.json

~/.piclaw/models.json:
```json
{
  "providers": {
    "custom-ai": {
      "baseUrl": "https://api.custom.com",
      "apiKey": "CUSTOM_API_KEY",
      "api": "openai-chat-completions",
      "models": [...] 
    }
  }
}
```

[14:00] Best Practices

✓ Use Opus/Sonnet for complex tasks
✓ Use Haiku/Flash for quick tasks
✓ Consider cost for large jobs
✓ Use scoped models for quick switching
✓ Monitor token usage

[15:00] Outro
"Configure your models wisely and Piclaw becomes even more powerful!"
```

### Recording Checklist

- [ ] Show API key setup
- [ ] Demonstrate /model command
- [ ] Show scoped models
- [ ] Configure defaults
- [ ] Display model comparison
- [ ] Register custom provider
- [ ] Edit models.json
- [ ] Test different models

### Model Test Cases

1. Complex reasoning task
2. Quick code generation
3. Long context analysis
4. Tool-heavy task

---

## 🎬 Tutorial 9: Extension Development

**Duration:** 25 minutes  
**Level:** Advanced  
**Objective:** Build a complete extension

*See EXTENSION_DEVELOPMENT.md for full details*

### Script Summary

```
[00:00] Intro
"Ready to supercharge Piclaw? Let's build an extension!"

[00:15] Architecture Overview

Piclaw + Extensions = Unlimited possibilities

What extensions can do:
- Register tools
- Add commands
- Listen to events
- Modify UI
- Register providers
- Custom logic

[02:00] Setup

Create ~/.piclaw/agent/extensions/
Create my-extension.ts

Basic structure:
```typescript
export default function (api) {
  // Register tools, commands, events
}
```

[05:00] Example 1: Custom Tool

Build a 'search-code' tool:

```typescript
api.registerTool({
  name: "search_code",
  label: "Search Code",
  description: "Search for patterns",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string" },
    },
    required: ["pattern"],
  },
  execute: async (id, params, signal, onUpdate, ctx) => {
    const result = await ctx.exec("grep", ["-r", params.pattern, "."]);
    return {
      content: [{ type: "text", text: result.stdout }],
      isError: false,
    };
  },
});
```

[10:00] Example 2: Slash Command

Build a 'deploy' command:

```typescript
api.registerCommand("deploy", {
  description: "Deploy to environment",
  handler: async (args, ctx) => {
    const env = args || "staging";
    await ctx.exec("./deploy.sh", [env]);
  },
});
```

[15:00] Example 3: Event Handler

Log all tool usage:

```typescript
api.on("tool_execution_end", (event, ctx) => {
  console.log(`Used: ${event.toolName}`);
});
```

[20:00] Debugging

- Console.log output
- /reload command
- Check settings.json
- TypeScript errors

[23:00] Testing

Create test file:

```typescript
import { describe, it, expect, vi } from 'vitest';
import extension from './index.js';

describe('extension', () => {
  it('registers commands', () => {
    const mockApi = { registerCommand: vi.fn() };
    extension(mockApi);
    expect(mockApi.registerCommand).toHaveBeenCalled();
  });
});
```

[24:00] Publishing

Option 1: NPM
```bash
npm publish
pi install npm:my-extension
```

Option 2: Git
```bash
pi install git:github.com/user/repo
```

[25:00] Outro
"You just built an extension! The possibilities are endless."
```

### Recording Checklist

- [ ] Create extension from scratch
- [ ] Show complete code
- [ ] Register工具
- [ ] Register命令
- [ ] Add事件处理
- [ ] Debug extension
- [ ] Run tests
- [ ] Publish to NPM (demo)
- [ ] Install and use

### Extension Ideas

1. Database tools
2. Deployment helpers
3. Code review automation
4. Custom provider
5. Team collaboration tools

---

## 🎬 Tutorial 10: Custom Tools & Commands

**Duration:** 20 minutes  
**Level:** Advanced  
**Objective:** Deep dive into custom tool creation

*Covered in Tutorial 9 - See EXTENSION_DEVELOPMENT.md*

---

## 🎬 Tutorial 11: Session Management & Branching

**Duration:** 15 minutes  
**Level:** Intermediate  
**Objective:** Master session tree navigation

### Script

```
[00:00] Intro
"Piclaw's branching system is like Git for your conversations. Let's master it!"

[00:15] Why Branch?

Save different approaches:
- Try refactor A
- Try refactor B
- Compare results
- Merge best parts

[01:00] The Session Tree

Visual representation:
```
Start
  |
  ├─> Implement v1
  │     └─> Fix bugs
  │
  └─> Implement v2
        └─> Optimize
```

[02:30] Basic Navigation

/new
→ Fresh session

/resume
→ Browse past sessions

/tree
→ Enter tree view
→ See all branches
→ Navigate freely

Show tree navigation:
- Up/down arrows
- Fold/unfold (Ctrl+←/→)
- Jump to node (Enter)

[06:00] Forking

At interesting point, type:
/fork

Creates new branch:
- Copies history
- Opens editor
- Continue independently

Use cases:
- Try risky change
- Experiment
- Compare implementations

[09:00] Cloning

/clone

Duplicates current branch:
- New session file
- Same history
- Independent continuation

Great for:
- Sharing sessions
- Backup before changes
- Team collaboration

[11:00] Tree Operations

/fork entryId
→ Fork from specific point

/clone entryId
→ Clone specific branch

/tree entryId
→ Navigate to point

[12:00] Best Practices

✓ Branch before big changes
✓ Label important nodes
✓ Keep experiments separate
✓ Merge good ideas
✓ Delete dead branches

[14:00] Real Example

1. Start session: "Build auth"
2. Implement database auth
3. /fork: "Try OAuth"
4. Implement OAuth
5. Compare both
6. Merge best parts

[15:00] Outro
"Branch freely, experiment boldly, merge wisely!"
```

### Recording Checklist

- [ ] Show tree structure
- [ ] Demonstrate /tree
- [ ] Fork session
- [ ] Clone session
- [ ] Navigate branches
- [ ] Show merging
- [ ] Display labels
- [ ] Delete branch

### Tree Scenarios

1. Simple linear session
2. Two-branch experiment
3. Complex multi-branch
4. Labeled important nodes

---

## 🎬 Tutorial 12: SubTool Loader Deep Dive

**Duration:** 20 minutes  
**Level:** Intermediate  
**Objective:** Master the SubTool Loader

### Script

```
[00:00] Intro
"50+ tools at your fingertips. Let's unlock the SubTool Loader!"

[00:15] What Is SubTool Loader?

Single tool that runs 50+ commands:
- Bash operations
- File management
- Git
- Docker
- Kubernetes
- Cloud tools
- And much more!

[01:30] Basic Usage

Ask LLM:
"Check git status"

LLM calls:
```json
{
  "subtool": "git",
  "args": {
    "command": "status"
  }
}
```

Result:
```
On branch main
Your branch is up to date.
```

[03:00] Available Sub-Tools

Categories:

Version Control:
- git

Containers:
- docker
- k8s

Cloud:
- aws
- terraform

Databases:
- db
- kafka
- redis

Package Managers:
- npm
- apt
- yum

System:
- systemctl
- journalctl
- ps
- kill

Info:
- df
- du
- free

Network:
- ping
- traceroute

[05:00] Common Patterns

1. Git operations:
```json
{
  "subtool": "git",
  "args": {"command": "add ."}
}
```

2. Docker management:
```json
{
  "subtool": "docker",
  "args": {"command": "ps -a"}
}
```

3. File search:
```json
{
  "subtool": "find",
  "args": {
    "command": ". -name '*.ts'"
  }
}
```

[08:00] Adding Custom Sub-Tools

Create src/tools/sub-tools/my-tool.ts:

```typescript
export async function myTool(cwd: string, args: any) {
  return {
    stdout: "Custom output",
    stderr: "",
    code: 0,
  };
}
```

Add to index.ts:
```typescript
export { myTool } from './my-tool';
```

Rebuild:
```bash
npm run build
```

[12:00] Advanced: Tool Options

```json
{
  "subtool": "bash",
  "args": {
    "command": "npm test",
    "cwd": "/path/to/project",
    "timeout": 300
  }
}
```

Parameters:
- cwd: Working directory
- timeout: Seconds before kill
- env: Environment variables

[16:00] Security Considerations

⚠️ Sub-tools execute real commands!

Disable dangerous tools:
```typescript
configureSubToolLoader({
  allowDangerousTools: false
});
```

Or disable specific tools:
```typescript
configureSubToolLoader({
  disabledTools: new Set(["rm", "format"])
});
```

[18:00] Audit Trail

All executions logged to ~/.piclaw/agent/audit.log:

```json
{
  "timestamp": "2026-05-06T10:30:00Z",
  "tool": "bash",
  "args": {"command": "ls -la"},
  "success": true,
  "duration": 150
}
```

[19:00] Best Practices

✓ Use specific tools when available
✓ Group related commands
✓ Check exit codes
✓ Set reasonable timeouts
✓ Log important operations

[20:00] Outro
"Master the SubTool Loader and command thousands of operations from your LLM!"
```

### Recording Checklist

- [ ] Show SubTool Loader interface
- [ ] Demonstrate git tool
- [ ] Show docker operations
- [ ] Create custom sub-tool
- [ ] Add to index
- [ ] Test new tool
- [ ] Show security options
- [ ] Display audit log
- [ ] Compare with direct commands

### Demo Scenarios

1. Git workflow (add, commit, push)
2. Docker container management
3. File operations (find, read, edit)
4. Custom tool creation
5. Security restrictions

---

## 🎬 Tutorial 13: CI/CD with Piclaw

**Duration:** 20 minutes  
**Level:** Expert  
**Objective:** Integrate Piclaw into CI/CD pipelines

### Script

```
[00:00] Intro
"Piclaw isn't just for interactive use. Let's automate it!"

[01:00] Use Cases

1. Automated code review
2. Test generation
3. Documentation updates
4. Dependency updates
5. Security scanning

[02:00] Non-Interactive Mode

piclaw --print "Review this code"

Outputs result and exits.

Perfect for scripts!

[03:00] JSON Mode

piclaw --mode json "Analyze code"

Outputs JSON:
```json
{
  "type": "message_start",
  "message": {...}
}
{
  "type": "message_update",
  "content": "..."
}
```

Easy to parse programmatically!

[05:00] GitHub Actions Example

```yaml
name: Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Piclaw
        run: npm install -g @mariozechner/pi-coding-agent
      
      - name: Run Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          piclaw --print --model anthropic:claude-sonnet-3.5 \
            "Review this PR: ${{ github.event.pull_request.html_url }}"
```

[08:00] GitLab CI Example

```yaml
code-review:
  stage: review
  image: node:18
  script:
    - npm install -g @mariozechner/pi-coding-agent
    - piclaw --print "Review $CI_PROJECT_DIR"
  only:
    - merge_requests
```

[10:00] Pre-commit Hook

.husky/pre-commit:
```bash
#!/bin/sh
piclaw --print --no-session \
  --thinking low \
  "Quick review of changes" \
  && exit 0
```

Reviews code before commit!

[12:00] Cron Job for Updates

Daily dependency check:

```bash
#!/bin/bash
piclaw --print \
  "Check for outdated dependencies in this project" \
  > daily-report.txt

mail -s "Daily Update Report" team@company.com < daily-report.txt
```

[14:00] RPC Mode for Integration

piclaw --mode rpc

Communicates via stdin/stdout JSONL.
Perfect for custom integrations!

[16:00] SDK Usage

```typescript
import { createAgentSession } from '@mariozechner/pi-coding-agent';

const { session } = await createAgentSession({
  cwd: process.cwd(),
});

await session.prompt("Review this code");
```

Programmatic control!

[18:00] Best Practices

✓ Use --print for scripts
✓ Use --mode json for parsing
✓ Set --no-session for CI
✓ Limit thinking in CI (--thinking low)
✓ Cache results when possible
✓ Use appropriate model for task

[20:00] Outro
"Automate Piclaw and let it work while you sleep!"
```

### Recording Checklist

- [ ] Show --print mode
- [ ] Demonstrate --mode json
- [ ] Create GitHub Actions workflow
- [ ] Show GitLab CI config
- [ ] Set up pre-commit hook
- [ ] Create cron job
- [ ] Demonstrate RPC mode
- [ ] Use SDK programmatically

### CI Scenarios

1. PR review bot
2. Nightly code analysis
3. Pre-commit checks
4. Dependency updates
5. Security scanning

---

## 🎬 Tutorial 14: Team Collaboration

**Duration:** 15 minutes  
**Level:** Advanced  
**Objective:** Share Piclaw workflows with your team

### Script

```
[00:00] Intro
"Piclaw is even better with your team. Let's collaborate!"

[01:00] Sharing Sessions

Export session:
/export team-meeting

Creates team-meeting.html

Share via:
- Email
- Slack
- GitHub
- Direct link

[02:00] Importing Sessions

piclaw --import team-meeting.html

Or in Piclaw:
/import team-meeting.html

Resumes exact state!

[04:00] Shared Context Files

Commit to repo:

.gitignore:
```
# Local Piclaw files
.piclaw/
```

Include in repo:
- .pi/AGENTS.md
- .pi/prompts/
- .pi/skills/

Team members automatically use them!

[06:00] Shared Extensions

Package.json:
```json
{
  "name": "team-extensions",
  "pi": {
    "extensions": ["./extensions"]
  }
}
```

Team installs:
```bash
pi install ./team-extensions
```

Everyone has same tools!

[09:00] Team Skills Repository

Shared directory:

```
team-skills/
├── deploy/
│   └── DEPLOY.md
├── review/
│   └── REVIEW.md
└── setup/
    └── ONBOARDING.md
```

Reference in .pi/skills/skill-paths.json:
```json
{
  "paths": ["./team-skills"]
}
```

[11:00] Review Workflow

1. Create PR
2. Tag @piclaw-bot
3. Bot runs:
   ```
   piclaw --print "Review PR"
   ```
4. Posts review to PR
5. Team discusses

[13:00] Knowledge Base

Shared sessions = knowledge base!

Search past solutions:
```
piclaw --search "authentication"
```

Finds similar problems solved before!

[14:00] Best Practices

✓ Share context files
✓ Version control skills
✓ Package team extensions
✓ Export interesting sessions
✓ Create shared prompts
✓ Document workflows

[15:00] Outro
"Together, your team is unstoppable with Piclaw!"
```

### Recording Checklist

- [ ] Export session
- [ ] Import session
- [ ] Show shared context files
- [ ] Demonstrate team extensions
- [ ] Set up skills repository
- [ ] Show review workflow
- [ ] Demonstrate knowledge base

### Collaboration Examples

1. Onboarding new team member
2. Team code review
3. Shared deployment process
4. Common problem solutions

---

## 🎬 Tutorial 15: Advanced Extension Patterns

**Duration:** 30 minutes  
**Level:** Expert  
**Objective:** Build sophisticated extensions

*See EXTENSION_DEVELOPMENT.md for full API reference*

### Script Summary

```
[00:00] Intro
"Ready for pro-level extensions? Let's build something amazing!"

[01:00] Pattern 1: Stateful Tool

Tool that maintains state across calls:

```typescript
let cache = new Map();

api.registerTool({
  name: "memoized_search",
  execute: async (id, params, signal, onUpdate, ctx) => {
    if (cache.has(params.query)) {
      return {
        content: [{ text: cache.get(params.query) }],
        isError: false,
      };
    }
    
    const result = await search(params.query);
    cache.set(params.query, result);
    
    return { content: [{ text: result }], isError: false };
  },
});
```

[05:00] Pattern 2: Multi-Step Workflow

Guide user through complex process:

```typescript
api.registerCommand("setup-project", {
  handler: async (args, ctx) => {
    const answers = await ctx.ui.custom(() => 
      new SetupWizard(tui, theme)
    );
    
    for (const step of answers.steps) {
      await executeStep(step, ctx);
    }
  },
});
```

[09:00] Pattern 3: Real-Time Monitoring

Stream updates to user:

```typescript
api.registerCommand("monitor", {
  handler: async (args, ctx) => {
    const interval = setInterval(async () => {
      const stats = await getStats();
      await ctx.sendMessage({
        customType: "stats",
        content: JSON.stringify(stats),
      });
    }, 5000);
    
    // Let user stop with /stop
  },
});
```

[12:00] Pattern 4: Custom Editor

Replace input with specialized editor:

```typescript
api.ui.setEditorComponent((tui, theme, keybindings) => {
  return new QueryEditor(tui, theme, keybindings);
});
```

[16:00] Pattern 5: Permission System

Control tool access:

```typescript
api.on("tool_call", (event, ctx) => {
  if (!userCanUseTool(ctx.user, event.toolName)) {
    return { block: true, reason: "Access denied" };
  }
});
```

[20:00] Pattern 6: Data Pipeline

Process data through stages:

```typescript
api.registerTool({
  name: "etl_pipeline",
  execute: async (id, params, signal, onUpdate, ctx) => {
    onUpdate({ text: "Extracting..." });
    const extracted = await extract(params.source);
    
    onUpdate({ text: "Transforming..." });
    const transformed = await transform(extracted);
    
    onUpdate({ text: "Loading..." });
    await load(transformed, params.dest);
    
    return { content: [{ text: "Pipeline complete!" }], isError: false };
  },
});
```

[24:00] Pattern 7: Integration Bridge

Connect external services:

```typescript
api.registerProvider("jira", {
  baseUrl: "https://company.atlassian.net",
  oauth: {
    name: "Jira",
    async login(callbacks) { /* OAuth flow */ },
    async refreshToken(creds) { /* Refresh */ },
    getApiKey(creds) { return creds.access; },
  },
  models: [], // No LLM, just API
});

api.registerTool({
  name: "jira_create_ticket",
  execute: async (id, params, signal, onUpdate, ctx) => {
    const jira = await ctx.getApiClient("jira");
    const ticket = await jira.createIssue(params);
    return { content: [{ text: ticket.url }], isError: false };
  },
});
```

[27:00] Testing Advanced Extensions

```typescript
describe("advanced extension", () => {
  it("maintains state", async () => {
    const mockApi = createMockApi();
    extension(mockApi);
    
    const tool = mockApi.getTool("memoized_search");
    await tool.execute("id1", { query: "test" });
    await tool.execute("id2", { query: "test" });
    
    expect(search).toHaveBeenCalledTimes(1); // Cached!
  });
});
```

[29:00] Performance Considerations

- Cache aggressively
- Stream large results
- Use AbortSignal
- Avoid blocking
- Monitor memory

[30:00] Outro
"With these patterns, you can build ANYTHING on Piclaw!"
```

### Recording Checklist

- [ ] Build stateful tool
- [ ] Create multi-step workflow
- [ ] Implement real-time monitoring
- [ ] Create custom editor
- [ ] Add permission system
- [ ] Build data pipeline
- [ ] Create integration bridge
- [ ] Test complex extensions
- [ ] Profile performance

### Advanced Patterns

1. Stateful computations
2. Interactive workflows
3. Real-time dashboards
4. Custom UIs
5. Access control
6. ETL pipelines
7. Service integrations

---

## 🎬 Tutorial 16: Troubleshooting & Debugging

**Duration:** 15 minutes  
**Level:** All Levels  
**Objective:** Solve common Piclaw problems

### Script

```
[00:00] Intro
"Everyone hits bugs. Let's learn to fix Piclaw issues fast!"

[01:00] Common Problem 1: "Piclaw won't start"

Symptoms:
$ piclaw
Command not found

Solution:
$ npm install -g @mariozechner/pi-coding-agent
# Or use npx
$ npx @mariozechner/pi-coding-agent

Check PATH:
$ which piclaw

[03:00] Common Problem 2: "API key error"

Symptoms:
Error: No API key for anthropic

Solution:
$ export ANTHROPIC_API_KEY=sk-ant-...

Or use /login:
/login
→ Select Anthropic
→ Follow OAuth flow

Check key:
echo $ANTHROPIC_API_KEY

[05:00] Common Problem 3: "Model not available"

Symptoms:
Error: Model gpt-4 not found

Solution:
/model
→ See available models

Check config:
$ cat ~/.piclaw/config.json
{
  "model": "anthropic:claude-3-opus-20240229"
}

List models:
piclaw --list-models

[07:00] Common Problem 4: "Tool not working"

Symptoms:
Error: Tool 'read' not found

Solution:
Check config:
$ cat ~/.piclaw/config.json
{
  "tools": ["read", "bash", "edit", "write"]
}

Enable all tools:
$ piclaw --no-tools  # Disables all
$ piclaw --tools read,bash,edit,write  # Enable specific

[09:00] Common Problem 5: "Context window full"

Symptoms:
Error: Context window exceeded

Solution:
/compact
→ Summarizes old messages

Or manually:
/tree
→ Navigate to earlier point
→ Continue from there

Prevent:
$ piclaw --thinking low  # Uses less context

[11:00] Common Problem 6: "Extension not loading