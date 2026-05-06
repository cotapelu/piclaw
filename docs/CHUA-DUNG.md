# 📋 CÁC CÁCH CAN THIỆP CHƯA SỬ DỤNG TRONG PICLAW

## Tổng quan
Dựa trên phân tích `COMPLETE_INTERVENTION_ANALYSIS.md` (60+ intervention points) và review code Piclaw, đây là các cách can thiệp chưa được triển khai.

---

## 🟢 1. Extension Events (25+ events)

### Session Events (7)
- [ ] `session_before_switch` - Chặn/giới hạn chuyển session
- [ ] `session_before_fork` - Tự động label/naming branch
- [ ] `session_before_compact` - Thêm hướng dẫn tóm tắt
- [ ] `session_tree` - Xử lý khi xem session tree
- [ ] `session_compact` - Sau khi compact xong
- [ ] `session_shutdown` - Trước khi đóng session

### Agent Events (4)
- [ ] `before_agent_start` - Sửa initial state trước khi bắt đầu
- [ ] `agent_start` - Khi agent bắt đầu
- [ ] `agent_end` - Post-processing khi kết thúc agent loop

### Message Events (3)
- [ ] `message_start` - Khi bắt đầu stream từ LLM
- [ ] `message_update` - Mỗi chunk token từ LLM
- [ ] `message_end` - Khi kết thúc message

### Tool Events (10+)
- [ ] `tool_call` - Chặn trước khi execute tool
- [ ] `tool_result` - Sửa kết quả sau khi execute
- [ ] `tool_execution_start` - Khi bắt đầu execute tool
- [ ] `tool_execution_update` - Trong quá trình execute
- [ ] `tool_execution_end` - Khi kết thúc execute

### Model Events (1)
- [ ] `model_select` - Khi đổi model (để tracking/analytics)

### Context Events (2)
- [ ] `context` - Sửa messages trước khi gửi tới LLM
- [ ] `before_provider_request` - Chỉnh sửa request payload
- [ ] `after_provider_response` - Xử lý response từ provider

### User Events (2)
- [ ] `input` - Hook khi user nhập input
- [ ] `user_bash` - Override bash execution

### Resource Events (1)
- [ ] `resources_discover` - Khi load skills/prompts/themes

---

## 🟡 2. UI Methods (12 methods)

- [ ] `api.ui.notify()` - Toast notification
- [ ] `api.ui.setFooter()` - Custom footer component
- [ ] `api.ui.setHeader()` - Custom header component
- [ ] `api.ui.setWidget()` - Widget trên trên/dưới editor
- [ ] `api.ui.select()` - Selection dialog
- [ ] `api.ui.confirm()` - Confirm dialog
- [ ] `api.ui.input()` - Input dialog
- [ ] `api.ui.setEditorComponent()` - Custom editor thay thế
- [ ] `api.ui.addAutocompleteProvider()` - Thêm autocomplete source
- [ ] `api.ui.setTheme()` - Theme switching động
- [ ] `api.ui.setWorkingIndicator()` - Spinner indicator
- [ ] `api.ui.setStatus()` - Status bar items

---

## 🟡 3. Context Actions (10 actions)

### Session Context (Base)
- [ ] `ctx.abort()` - Dừng agent loop
- [ ] `ctx.hasPendingMessages()` - Kiểm tra có message pending
- [ ] `ctx.getContextUsage()` - Xem token usage
- [ ] `ctx.getSystemPrompt()` - Xem system prompt hiện tại
- [ ] `ctx.shutdown()` - Tắt session

### Command Context (Slash Commands)
- [ ] `ctx.waitForIdle()` - Đợi agent idle
- [ ] `ctx.newSession()` - Tạo session mới
- [ ] `ctx.fork()` - Tạo branch mới
- [ ] `ctx.navigateTree()` - Di chuyển trong tree
- [ ] `ctx.switchSession()` - Chuyển session
- [ ] `ctx.reload()` - Reload session
- [ ] `ctx.sendMessage()` - Gửi message tùy chỉnh
- [ ] `ctx.sendUserMessage()` - Gửi message như user

---

## 🟢 4. Registration Methods (4 loại)

- [ ] `api.registerCommand()` - Đăng ký slash command mới
- [ ] `api.registerProvider()` - Thêm provider tùy chỉnh (nâng cao)
- [ ] `api.registerShortcut()` - Keyboard shortcut
- [ ] `api.registerFlag()` - CLI flag

---

## 🔵 5. Message Types

- [ ] Declaration merging cho CustomAgentMessages
- [ ] Custom message renderers
- [ ] Message type extensions

---

## 🔵 6. Session Management

- [ ] Listen `session_before_switch` event
- [ ] Listen `session_before_fork` event
- [ ] Listen `session_before_compact` event
- [ ] Auto-label important branches
- [ ] Custom compact strategies

---

## 🔵 7. Tool Rendering

- [ ] Custom `renderCall()` cho tool calls
- [ ] Custom `renderResult()` cho tool results
- [ ] Rich display với syntax highlighting

---

## 🔵 8. Theme Integration

- [ ] Dynamic theme switching
- [ ] Custom color schemes
- [ ] Syntax highlighting rules

---

## 🔵 9. Provider Advanced Features

- [ ] OAuth flow cho provider
- [ ] Custom `getApiKey` implementation
- [ ] Model filtering/categorization
- [ ] Provider-specific headers

---

## 🔵 10. Event Bus

- [ ] Direct event bus access
- [ ] Inter-extension communication
- [ ] Custom event types

---

## ⭐ 11. AgentSessionRuntime Pattern (RECOMMENDED)

### Tại sao AgentSessionRuntime thay vì AgentSession?

Khi cần tạo **nhiều sessions** hoặc quản lý **session lifecycle**, AgentSessionRuntime là lựa chọn tốt nhất:

#### Ưu điểm AgentSessionRuntime:
- ✅ **Lifecycle Management**: `newSession()`, `switchSession()`, `fork()` tích hợp sẵn
- ✅ **Services Auto-management**: Auth, settings, model registry được tạo tự động
- ✅ **Session Events**: `session_before_switch`, `session_before_fork`, `session_shutdown`
- ✅ **Extension Support**: Extension runner được quản lý chuyên sâu
- ✅ **Resource Efficient**: Chia sẻ resources giữa sessions khi cần

#### So sánh: AgentSession vs AgentSessionRuntime

| Aspect | AgentSession | AgentSessionRuntime |
|--------|--------------|---------------------|
| Tạo đơn giản | ❌ Phức tạp, nhiều dependencies | ✅ Chỉ cần factory + options |
| Quản lý nhiều sessions | ❌ Khó | ✅ Dễ (switch/new/fork) |
| Services management | ❌ Tự lo | ✅ Runtime handle |
| Session lifecycle events | ❌ Không có | ✅ Đầy đủ (section #1) |
| Extension support | ⚠️ Cần khởi tạo lại | ✅ Tích hợp sẵn |

#### Usage Pattern:
```typescript
// Recommended: Dùng AgentSessionRuntime để tạo "bậy sessions"
const runtime = await createAgentSessionRuntime(factory, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(cwd),
});

// Tạo sessions dễ dàng
await runtime.newSession();      // Session mới
await runtime.fork("entry-123"); // Branch từ entry  
await runtime.switchSession(path); // Chuyển session

// KHÔNG nên tạo AgentSession trực tiếp nếu cần lifecycle
const session = new AgentSession(config); // Chỉ dùng khi cần custom config hoàn toàn
```

---

## 💡 Ghi chú triển khai

Các mục được đánh dấu [ ] là những tính năng chưa được Piclaw sử dụng. Các mục được đánh dấu [x] là những tính năng đã được triển khai hoặc đang được sử dụng.

**Ưu tiên triển khai:**
1. **High**: Context manipulation, UI widgets, session hooks
2. **Medium**: Custom commands, tool rendering, autocomplete
3. **Low**: OAuth, event bus, theme switching