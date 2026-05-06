# 📋 Todo List

## Phase 1: Core Foundation ✅

- [x] Set up project structure with dual dependency model
- [x] Configure pi-coding-agent as runtime dependency
- [x] Configure llm-context for source code reasoning
- [x] Implement SubTool Loader (50+ system tools)
- [x] Create basic CLI interface
- [x] Implement config management (~/.piclaw/config.json)
- [x] Add slash commands (/config, /piclaw-set, /tools, /piclaw-status)
- [x] Build extension system for custom commands

## Phase 2: Agent State & Streaming Management ✅

- [x] Analyze agent state machine (isStreaming, streamingMessage)
- [x] Document streaming interruption handling
- [x] Implement proper abort/error handling in stream flows
- [x] Ensure graceful degradation on stream failure
- [x] Test agent idle vs streaming states

## Phase 3: TUI & Interactive Mode ✅

- [x] Implement enhanced status display showing streaming state
- [x] Add visual indicators for streaming progress  
- [x] Implement agent state panel (isStreaming, pendingToolCalls, streamingMessage)
- [x] Add interruption controls (abort, pause, resume)
- [x] Implement streaming history replay
- [x] Add real-time token counters
- [x] Analyze all 15 intervention methods and document in CAN_THIEU_PHAN_TICH.md & INTERVENTION_ANALYSIS.md

## Phase 4: Advanced Features ✅

- [x] Context window management
- [x] Message compaction/summarization
- [x] Streaming timeout handling
- [x] Retry logic for failed streams
- [x] Session auto-save during streaming
- [x] Tool execution progress tracking

## Phase 5: Testing & Documentation ✅

- [x] Unit tests for agent state transitions
- [x] Integration tests for streaming interruption
- [x] End-to-end tests for full streaming flow
- [x] Update API documentation
- [x] Create usage examples
- [x] Performance benchmarking

## Phase 6: Production Hardening ✅

- [x] Error recovery mechanisms
- [x] Memory leak prevention in streaming
- [x] Concurrent stream handling
- [x] Rate limiting and backoff strategies
- [x] Security audit for tool execution
- [x] Input validation and sanitization

## Phase 7: Documentation & Knowledge Sharing ✅

- [x] Create quick start guide for new users
- [x] Document extension development workflow
- [x] Create video tutorials for key features
- [x] Publish to npm registry
- [x] Create community Discord/Slack channel

## Archived Tasks

- [x] Initial project setup (2026-04-21)
- [x] Basic agent functionality (2026-05-01)
- [x] SubTool Loader implementation (2026-05-03)
- [x] Config system (2026-05-04)
- [x] Extension system (2026-05-05)
- [x] Streaming state analysis (2026-05-06)
- [x] Full intervention analysis & documentation (2026-05-06)
- [x] Phase 4 Advanced Features analysis (2026-05-06)
- [x] Phase 5 Testing & Documentation (2026-05-06)
- [x] Phase 6 Production Hardening (2026-05-06)
- [x] Refactor piclaw-core.ts to use factory pattern (2026-05-06)
- [x] Generate updated custom models (2026-05-06)

---

## Phase 8: Extension Features Implementation (Pending)

### 8.1 Session Events (High Priority)
- [ ] Implement `session_before_switch` event hook
- [ ] Implement `session_before_fork` event hook
- [ ] Implement `session_before_compact` event hook
- [ ] Implement `session_shutdown` event hook

### 8.2 Context Manipulation
- [ ] Implement `ctx.abort()` - Dừng agent loop
- [ ] Implement `ctx.hasPendingMessages()` - Kiểm tra message pending
- [ ] Implement `ctx.getContextUsage()` - Token usage tracking
- [ ] Implement `ctx.getSystemPrompt()` - View current system prompt

### 8.3 UI Enhancements
- [ ] Add `api.ui.notify()` - Toast notifications
- [ ] Add `api.ui.setFooter()` - Custom footer component
- [ ] Add `api.ui.select()` - Selection dialog
- [ ] Add `api.ui.confirm()` - Confirm dialog
- [ ] Add `api.ui.input()` - Input dialog

### 8.4 Custom Commands
- [ ] Implement `api.registerCommand()` for slash commands
- [ ] Add `api.registerShortcut()` for keyboard shortcuts

### 8.5 Tool Rendering
- [ ] Custom `renderCall()` for tool calls
- [ ] Custom `renderResult()` for tool results

---

## Notes

### Agent States Summary

| State | isStreaming | streamingMessage | Description |
|-------|-------------|------------------|-------------|
| **IDLE** | false | undefined | Agent ready for new prompt |
| **STREAMING** | true | defined | LLM actively streaming tokens |
| **ERROR** | false | undefined | Stream failed or aborted |

### Dual Dependency Model

- **Runtime**: `@mariozechner/pi-coding-agent` (npm install)
- **Reasoning**: `llm-context/` (source code analysis only)

Never import from llm-context at runtime!