# 🏗️ Kiến Trúc: Cách PiCodingAgent Dùng PiAgentCore

*Tài liệu chi tiết cách `llm-context/packages/coding-agent` sử dụng `@mariozechner/pi-agent-core`*

---

## 🔍 Tổng Quan

`pi-coding-agent` (ứng dụng CLI coding chuyên dụng) được xây dựng **dựa trên** `pi-agent-core` (framework agent tổng quát) theo pattern **Composition** (tổ hợp) thay vì kế thừa.

### Mối Quan Hệ
```
pi-agent-core (Framework tổng quát)
    ↓
    └───> pi-coding-agent (Ứng dụng CLI chuyên dụng)
```

**Giống như:** React (framework) → Next.js (ứng dụng web)

---

## 1. 💡 Cách Dùng Core: Tạo Instance & Inject Config

### File: `src/core/sdk.ts`

`pi-coding-agent` **KHÔNG KẾ THỪA** class `Agent`, mà **TẠO INSTANCE** và **INJECT** các config đặc thù vào:

```typescript
import { Agent, type AgentMessage, type ThinkingLevel } from "@mariozechner/pi-agent-core";

// Trong createAgentSession():
agent = new Agent({
  initialState: {
    systemPrompt: "",
    model,
    thinkingLevel,
    tools: [],
  },
  
  // 👉 1. Inject custom convertToLlm (chuyển AgentMessage → LLM Message)
  convertToLlm: convertToLlmWithBlockImages,
  
  // 👉 2. Inject custom streamFn (gọi LLM với API key, retry...)
  streamFn: async (model, context, options) => {
    const auth = await modelRegistry.getApiKeyAndHeaders(model);
    return streamSimple(model, context, {
      ...options,
      apiKey: auth.apiKey,
      timeoutMs: options?.timeoutMs ?? providerRetrySettings.timeoutMs,
      maxRetries: options?.maxRetries ?? providerRetrySettings.maxRetries,
    });
  },
  
  // 👉 3. Inject transformContext (xử lý context trước khi gửi LLM)
  transformContext: async (messages) => {
    const runner = extensionRunnerRef.current;
    if (!runner) return messages;
    return runner.emitContext(messages); // Cho phép extensions sửa context
  },
  
  sessionId: sessionManager.getSessionId(),
  // ... các config khác
});
```

**💡 Ý nghĩa:** Core cung cấp "vỏ" (Agent class), coding-agent cung cấp "nội dung" (các function xử lý logic đặc thù).

---

## 2. 🔄 Dùng Vòng Lặp Từ Core

### File: `src/core/agent-session.ts`

`pi-coding-agent` gọi `runAgentLoop()` từ core để thực thi vòng lặp LLM:

```typescript
import { runAgentLoop, runAgentLoopContinue } from "./agent-loop.js";

// Trong AgentSession:
private async runPromptMessages(messages: AgentMessage[]): Promise<void> {
  await this.runWithLifecycle(async (signal) => {
    // 👉 GỌI HÀM TỪ CORE
    await runAgentLoop(
      messages,                              // Dữ liệu đầu vào
      this.createContextSnapshot(),           // Context snapshot
      this.createLoopConfig(),                // Config vòng lặp
      (event) => this.processEvents(event),   // Handler events
      signal,
      this.streamFn                           // Stream function đã inject ở trên
    );
  });
}
```

**💡 Ý nghĩa:** Core chứa logic "gửi prompt → đợi LLM → parse tool calls → execute tools → repeat". Coding-agent chỉ cần **gọi hàm này** và cung cấp đầu vào.

---

## 3. 🛠️ Implement Interface `AgentTool` Cho Các Công Cụ

### File: `src/core/tools/bash.ts` (tương tự cho read, write, edit, grep...)

Để core có thể execute tool, coding-agent phải implement đúng chuẩn `AgentTool` interface:

```typescript
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { bashSchema } from "./schema.js";

export function createBashToolDefinition(cwd: string): AgentTool {
  return {
    name: "bash",
    label: "Execute bash command",
    description: "Execute bash commands in the terminal",
    
    // 👉 Schema định nghĩa params (dùng Zod)
    parameters: bashSchema,
    
    // 👉 IMPLEMENT execute() - Core sẽ gọi hàm này!
    execute: async (toolCallId: string, params: any, signal?: AbortSignal) => {
      const result = await executeBash(params.command, { cwd, timeout: params.timeout });
      
      return {
        content: [{
          type: "text",
          text: result.code === 0 ? result.stdout : result.stderr
        }],
        details: {  // Dữ liệu có cấu trúc cho UI/logging
          code: result.code,
          duration: result.duration,
          stdout: result.stdout,
          stderr: result.stderr
        },
        terminate: false,
      };
    },
    
    executionMode: "sequential", // Hoặc "parallel"
  };
}
```

**💡 Ý nghĩa:** Core đóng vai trò "người gọi" (caller), coding-agent đóng vai trò "người thực thi" (executor) thông qua interface chuẩn.

---

## 4. 🧩 Mở Rộng Types Của Core Qua Declaration Merging

### File: `src/core/messages.ts`

`pi-coding-agent` thêm custom message types vào `AgentMessage` của core mà **không cần sửa source core**:

```typescript
// Thêm custom types vào union type AgentMessage của core
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    branchSummary: BranchSummaryMessage;      // Riêng cho coding-agent
    compactionSummary: CompactionSummaryMessage; // Riêng cho coding-agent
  }
}
```

**💡 Ý nghĩa:** Nhờ `declare module`, mọi nơi import `AgentMessage` từ core sẽ **tự động có** các types mới này. Rất tiện cho việc extend!

---

## 5. 🎁 Wrap Core Bằng Lớp Tùy Chỉnh

### File: `src/core/agent-session.ts`

`AgentSession` wrap `Agent` (core) và thêm tính năng đặc thù:

```typescript
class AgentSession {
  private agent: Agent; // 👈 Instance từ core

  constructor(options: AgentSessionOptions) {
    // Tạo core agent
    this.agent = new Agent({...});
  }

  // Expose state của core ra ngoài
  get state(): AgentState {
    return this.agent.state;
  }

  // Thêm tính năng: Lưu session vào file (core không có)
  async save() {
    await this.sessionManager.save(this.agent.state);
  }

  // Thêm tính năng: Compaction context (core không có)
  async compactContext() {
    await compactSession(this.agent.state);
  }
}
```

**💡 Ý nghĩa:** Pattern Decorator/Wrapper. Core làm nhiệm vụ chính, wrapper thêm tính năng phụ (persistence, UI events, logging...).

---

## 📊 So Sánh Nhanh

| Tính Năng | `pi-agent-core` | `pi-coding-agent` |
|----------|-----------------|-------------------|
| **Vai trò** | Framework tổng quát | App CLI chuyên dụng |
| **Quản lý state** | ✅ Class `Agent` | ✅ Dùng `Agent` từ core |
| **Vòng lặp LLM** | ✅ `runAgentLoop()` | ✅ Gọi `runAgentLoop()` từ core |
| **Tool interface** | ✅ Định nghĩa `AgentTool` | ✅ Implement (bash, read, edit...) |
| **Auth/API Key** | ❌ Không có | ✅ Inject vào `streamFn` |
| **Session persistence** | ❌ Không có | ✅ `AgentSession` thêm tính năng |
| **Context compaction** | ❌ Không có | ✅ `AgentSession` thêm tính năng |
| **Tích hợp TUI** | ❌ Không có | ✅ Qua events system |

---

## 🎯 Lợi Ích Của Kiến Trúc Này

1. **Tái sử dụng cao:** `pi-agent-core` có thể dùng cho app khác (web, mobile...)
2. **Tách biệt rõ ràng:** Core làm nền tảng, app làm đặc thù
3. **Dễ bảo trì:** Sửa core → tự động cập nhật cho coding-agent
4. **Dễ test:** Test core độc lập với app
5. **Extensibility:** Dùng `declare module` để extend types không phá vỡ source

---

## 📝 Code Flow Điển Hình

```
1. User gõ lệnh
   ↓
2. Tạo AgentSession (wrap Agent từ core)
   ↓
3. Gọi agent.prompt() 
   ↓
4. [CORE] runAgentLoop() bắt đầu
   ├─> Gửi prompt qua streamFn (đã inject)
   ├─> Nhận LLM response
   ├─> Parse tool calls
   ├─> Execute tools (AgentTool đã implement)
   ├─> Lặp lại nếu cần
   └─> Trả về messages
   ↓
5. AgentSession xử lý events (UI update, save session...)
   ↓
6. Hiển thị kết quả cho user
```

---

## 🔗 Các File Quan Trọng

- `@mariozechner/pi-agent-core` (NPM package)
  - `agent.ts` - Class Agent
  - `agent-loop.ts` - Hàm runAgentLoop
  - `types.ts` - Interface AgentTool, AgentMessage...
- `llm-context/packages/coding-agent/src/`
  - `core/sdk.ts` - Tạo Agent instance
  - `core/agent-session.ts` - Wrap Agent
  - `core/tools/*.ts` - Implement AgentTool
  - `core/messages.ts` - Extend types

---

## 💬 Kết Luận

`pi-coding-agent` dùng `pi-agent-core` theo pattern **"Framework + Implementation"**:
- **Core** = Framework (chứa logic chung)
- **Coding-agent** = Implementation (chứa logic đặc thù)

Thay vì viết lại từ đầu, coding-agent **kế thừa sức mạnh** của core và chỉ tập trung vào **điểm đặc thù** của ứng dụng CLI coding.

👉 Đây là kiến trúc lý tưởng cho các AI agent system!