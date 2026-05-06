# 📊 Phân Tích Toàn Bộ Hệ Thống Piclaw
## Các Cách Can Thiệp Vào Hệ Thống

Bản phân tích chi tiết tất cả các phương pháp can thiệp, mở rộng và tùy biến hệ thống Piclaw (xây dựng trên `@mariozechner/pi-coding-agent`).

---

## 🎯 TỔNG QUAN KIẾN TRÚC

Piclaw là một AI Coding Agent CLI sử dụng kiến trúc **Dual Dependency Model**:
- **Runtime**: `@mariozechner/pi-coding-agent` (npm package)
- **Reasoning**: `llm-context/` (source code để phân tích, không import trực tiếp)

Hệ thống được thiết kế với nguyên tắc **"Extensibility First"** - mọi thứ đều có thể mở rộng mà không cần fork/modify core.

---

## 🔧 CÁCH CAN THIỆP VÀO HỆ THỐNG

### 1. EXTENSION SYSTEM (Hệ Thống Mở Rộng Cốt Lõi)

**Tên gọi**: Extension System / `ExtensionAPI`

**Mô tả**: Cơ chế mạnh nhất để can thiệp sâu vào mọi luồng xử lý của hệ thống. Extension có thể:
- Theo dõi và phản ứng với mọi sự kiện (event)
- Đăng ký công cụ mới (tools)
- Thêm lệnh mới (slash commands)
- Tạo shortcut bàn phím
- Thay đổi UI (header, footer, widget, custom editor)
- Chặn/phản hồi mọi webhook trước khi gửi LLM

**Cách triển khai**:

```typescript
// File: ~/.piclaw/agent/extensions/my-extension.ts
export default function (api: ExtensionAPI) {
  // Đăng ký công cụ mới
  api.registerTool({
    name: "my_tool",
    label: "My Custom Tool",
    description: "Does something amazing",
    parameters: { /* TypeBox schema */ },
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      return {
        content: [{ type: "text", text: "Done!" }],
        details: { /* metadata */ },
        isError: false,
      };
    },
  });

  // Lắng nghe sự kiện LLM stream
  api.on("message_update", (event, ctx) => {
    console.log("LLM đang gõ:", event.message.content);
  });

  // Chặn trước khi gửi request đến provider
  api.on("before_provider_request", (event, ctx) => {
    event.payload = { ...event.payload, custom_field: "modified" };
    return event.payload;
  });

  // Thêm lệnh mới
  api.registerCommand("my-command", {
    description: "Run my custom command",
    getArgumentCompletions: (prefix) => [{ label: "option1" }],
    handler: async (args, ctx) => {
      await ctx.sendMessage({
        customType: "my-message",
        content: "Command executed!",
      });
    },
  });

  // Đăng ký shortcut
  api.registerShortcut("ctrl+shift+m", {
    description: "Open my menu",
    handler: async (ctx) => {
      ui.notify("Menu opened!");
    },
  });

  // Chỉnh sửa UI
  api.ui.setWidget("my-widget", ["Status: Online"], { placement: "aboveEditor" });
  
  api.ui.setFooter((tui, theme, footerData) => {
    // Trả về custom component footer
    return new MyFooterComponent(tui, theme);
  });
}
```

**Extension có thể đăng ký sự kiện** (sử dụng `api.on()`):
- **Session Events**: `session_start`, `session_tree`, `session_before_switch`, `session_before_fork`, `session_compact`, `session_shutdown`
- **Agent Events**: `before_agent_start`, `agent_start`, `agent_end`, `turn_start`, `turn_end`
- **Message Events**: `message_start`, `message_update`, `message_end`
- **Tool Events**: `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
- **Tool Call Events**: `tool_call` (chặn/trả lời trước khi thực thi)
- **Tool Result Events**: `tool_result` (chặn/sửa kết quả sau khi thực thi)
- **Model Events**: `model_select`
- **Context Events**: `context` (sửa messages trước khi LLM)
- **Provider Events**: `before_provider_request`, `after_provider_response`
- **User Events**: `user_bash`, `input`
- **Resource Events**: `resources_discover`

**Cách kích hoạt extension**:
- Đặt file `.ts` hoặc `.js` vào `~/.piclaw/agent/extensions/`
- Đặt vào `.piclaw/extensions/` (project-level)
- Hoặc cài đặt qua npm/git: `pi install <package>`
- Extension tự động được load khi Piclaw khởi động

**Ưu điểm**:
- ✅ Can thiệp sâu nhất vào mọi luồng
- ✅ Không cần rebuild lại core
- ✅ Hỗ trợ TypeScript, hot-reload
- ✅ Có thể chia sẻ qua npm/git (Pi Packages)
- ✅ Tiếp cận mọi service (ModelRegistry, SessionManager, EventBus)

**Nhược điểm**:
- ⚠️ Yêu cầu kiến thức TypeScript
- ⚠️ Extension chạy với quyền system đầy đủ (security risk)

---

### 2. SKILLS SYSTEM (Kỹ Năng/Workflow)

**Tên gọi**: Skills / Skills System

**Mô tả**: Định nghĩa các workflow/task lặp lại dưới dạng markdown. LLM tự động nhận biết và đề xuất sử dụng khi phù hợp.

**Cách triển khai**:

Tạo file `~/.pi/agent/skills/my-skill/SKILL.md`:

```markdown
# Deploy to Production

Sử dụng skill này khi user yêu cầu deploy ứng dụng lên production.

## Steps
1. Run tests: `npm test`
2. Build: `npm run build`
3. Deploy: `./deploy.sh production`
4. Verify: Check logs at `/var/log/app.log`

## Notes
- Always backup before deploying
- Notify team on Slack after deploy
```

Hoặc định nghĩa inline qua API extension:

```typescript
api.on("resources_discover", (event, ctx) => {
  return {
    skillPaths: ["/path/to/my/skills"],
  };
});
```

**Cách sử dụng**:
- User gõ: `/skill:deploy`
- Hoặc LLM tự đề xuất khi phát hiện context khớp
- Skill được inject vào system prompt dưới dạng instruction

**Ưu điểm**:
- ✅ Dễ viết (chỉ cần markdown)
- ✅ LLM tự quyết định khi nào dùng
- ✅ Hỗ trợ parameter (thay thế `{{variable}}`)
- ✅ Dễ bảo trì, dễ chia sẻ

**Nhược điểm**:
- ⚠️ Không thể thực thi code trực tiếp (chỉ là instruction)
- ⚠️ Phụ thuộc vào khả năng hiểu của LLM

---

### 3. PROMPT TEMPLATES (Mẫu Câu Lệnh)

**Tên gọi**: Prompt Templates / `.pi/prompts/`

**Mô tả**: Các prompt thường dùng được lưu dưới dạng file, gọi nhanh qua lệnh `/tên`.

**Cách triển khai**:

Tạo file `~/.pi/agent/prompts/review.md`:

```markdown
# Code Review Template

Review this code for:
1. Security vulnerabilities
2. Performance issues  
3. Code quality (clean code, SOLID)
4. Test coverage

## Context
{{context}}

## Focus on: {{focus_area}}
```

**Cách sử dụng**:
- Trong editor, gõ `/review` → prompt tự động expand
- Hoặc `/review Focus on: performance`

**Có thể dùng parameter**: `{{variable}}` được thay thế tại runtime

**Ưu điểm**:
- ✅ Rất nhanh, không cần gõ lại prompt dài
- ✅ Dễ chia sẻ (commit vào git)
- ✅ Hỗ trợ biến động (dynamic params)
- ✅ Không cần code

**Nhược điểm**:
- ⚠️ Chỉ dùng được trong editor
- ⚠️ Không tự động thực thi

---

### 4. CUSTOM TOOLS (Công Cụ Tùy Chỉnh)

**Tên gọi**: Custom Tools / `ToolDefinition`

**Mô tả**: Đăng ký các hàm có thể được LLM gọi trực tiếp (như `read`, `bash`, `edit` nhưng do bạn tự định nghĩa).

**Cách triển khai**:

**Cách 1: Qua Extension (recommended)**

```typescript
api.registerTool({
  name: "search_database",
  label: "Search Database",
  description: "Query the production database",
  parameters: {
    // TypeBox schema
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number", default: 10 },
    },
    required: ["query"],
  },
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    const result = await db.query(params.query);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      details: { rowCount: result.length },
      isError: false,
    };
  },
});
```

**Cách 2: Qua config Piclaw (khởi tạo session)**

File `src/piclaw-core.ts`:

```typescript
export async function bootPiclaw(options: PiclawCoreOptions) {
  // ...
  const sessionResult = await createAgentSessionFromServices({
    services,
    sessionManager,
    customTools: [
      createCustomTool1(),
      createCustomTool2(),
    ],
  });
}
```

**Cách 3: SubTool Loader** (thêm vào danh sách 50+ tool sẵn có)

```typescript
// File tools/sub-tools/my-tool.ts
export async function myTool(cwd: string, args: any) {
  return {
    stdout: "Result",
    stderr: "",
    code: 0,
  };
}
```

Sau đó thêm vào `tools/sub-tools/index.ts` → tự động xuất hiện trong `subtool_loader`

**Ưu điểm**:
- ✅ LLM gọi trực tiếp như built-in tools
- ✅ Có thể return structured data, error handling
- ✅ Hỗ trợ streaming (onUpdate callback)
- ✅ Tích hợp với UI (renderCall/renderResult)

**Nhược điểm**:
- ⚠️ Cần code TypeScript
- ⚠️ Phải định nghĩa schema TypeBox

---

### 5. PROVIDER SYSTEM (Nguồn LLM)

**Tên gọi**: Provider System / Custom Providers

**Mô tả**: Đăng ký API LLM mới (OpenAI-compatible, Anthropic-compatible, hoặc custom API).

**Cách triển khai**:

**Cách 1: Qua Extension** (dynamic, không cần restart)

```typescript
api.registerProvider("my-ai", {
  baseUrl: "https://api.my-ai.com/v1",
  apiKey: "MY_AI_API_KEY", // Tên env var
  api: "openai-chat-completions", // hoặc "anthropic-messages"
  models: [
    {
      id: "my-model-v1",
      name: "My AI Model",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 16384,
      maxTokens: 8192,
    },
  ],
});
```

**Cách 2: Via `models.json`** (static config)

File `~/.piclaw/agent/models.json`:

```json
{
  "providers": {
    "custom-ai": {
      "baseUrl": "https://api.custom.com",
      "apiKey": "API_KEY_ENV_NAME",
      "api": "openai-chat-completions",
      "models": [
        {
          "id": "fast-model",
          "name": "Fast Model",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0.1, "output": 0.3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 8192,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

**Cách 3: OAuth Provider** (cho login flow)

```typescript
api.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // Hiện browser, lấy token
      return { access: "token", refresh: "token" };
    },
    async refreshToken(credentials) {
      // Refresh token khi hết hạn
      return newCreds;
    },
    getApiKey(credentials) {
      return credentials.access;
    },
  },
});
```

**Ưu điểm**:
- ✅ Hỗ trợ mọi định dạng API (OpenAI, Anthropic, custom)
- ✅ Có thể thêm OAuth (SSO)
- ✅ Cập nhật model list động
- ✅ Không cần sửa core

**Nhược điểm**:
- ⚠️ API phải tương thích (chat completions hoặc messages format)

---

### 6. SLASH COMMANDS (Lệnh Gõ `/`)

**Tên gọi**: Slash Commands System

**Mô tả**: Đăng ký lệnh mới hiển thị khi user gõ `/` trong editor.

**Cách triển khai**:

Chỉ có thể làm qua Extension:

```typescript
api.registerCommand("translate", {
  description: "Translate text to another language",
  getArgumentCompletions: (prefix) => {
    // Gợi ý khi đang gõ argument
    return [
      { label: "en (English)" },
      { label: "vi (Vietnamese)" },
      { label: "ja (Japanese)" },
    ];
  },
  handler: async (args, ctx) => {
    // args là string sau tên command, ví dụ: "en Hello world"
    await ctx.sendMessage({
      customType: "translation",
      content: `Translating to ${args}...`,
    });
  },
});
```

**Cách sử dụng**:
1. User gõ `/translate en Hello` trong editor
2. Handler nhận được `args = "en Hello"`
3. Handler làm gì đó (thường là `ctx.sendMessage()` hoặc `ctx.sendUserMessage()`)

**Ưu điểm**:
- ✅ Ngay lập tức trong editor
- ✅ Gợi ý autocomplete
- ✅ Tương tác với session (gửi message, đọc context)

**Nhược điểm**:
- ⚠️ Chỉ dùng được trong editor
- ⚠️ Phải qua Extension
- ⚠️ Không thể chặn command built-in

---

### 7. AUTOCOMPLETE PROVIDER (Gợi Ý Editor)

**Tên gọi**: Autocomplete Provider

**Mô tả**: Tùy chỉnh gợi ý khi gõ `@` (tham chiếu file) hoặc trong editor.

**Cách triển khai**:

```typescript
api.ui.addAutocompleteProvider((currentProvider) => {
  return {
    ...currentProvider,
    // Override hoặc wrap các method
    getSuggestions: async (context) => {
      const defaultSugs = await currentProvider.getSuggestions?.(context);
      // Thêm suggestions tùy chỉnh
      return [
        ...defaultSugs,
        { label: "@my-custom-ref", type: "custom" },
      ];
    },
  };
});
```

**Ưu điểm**:
- ✅ Cải thiện trải nghiệm editor
- ✅ Tích hợp file/project

**Nhược điểm**:
- ⚠️ Khó debug
- ⚠️ Hạn chế: chỉ gợi ý text, không thực thi logic phức tạp

---

### 8. CUSTOM COMMAND (CLI Arguments)

**Tên gọi**: CLI Commands / `Command` pattern

**Mô tả**: Thêm đối số mới cho CLI (`piclaw --my-flag`).

**Cách triển khai**:

Sửa file `src/cli/args.ts`:

```typescript
export interface Options {
  // ... existing
  myFlag?: boolean;
}

export function parseOptions(args: string[]): { opts: Options; cliOverrides: PiclawConfig } {
  // ...
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--my-flag") {
      opts.myFlag = true;
      cliOverrides.myFlag = true;
    }
  }
  // ...
}
```

Sau đó dùng trong `src/main.ts` hoặc `src/piclaw-core.ts`:

```typescript
if (opts.myFlag) {
  // Làm gì đó
}
```

**Ưu điểm**:
- ✅ Điều khiển từ CLI
- ✅ Truyền config xuống sâu

**Nhược điễm**:
- ⚠️ Phải sửa code core, rebuild
- ⚠️ Không linh hoạt như Extension

---

### 9. THEME SYSTEM (Giao Diện Terminal)

**Tên gọi**: Theme System

**Mô tả**: Tùy chỉnh màu sắc, icon, border của TUI.

**Cách triển khai**:

Tạo file `~/.pi/agent/themes/my-theme.json`:

```json
{
  "name": "My Theme",
  "colors": {
    "background": "#1a1a2e",
    "foreground": "#e6e6e6",
    "primary": "#00d4aa",
    "secondary": "#ff6b6b",
    "border": "#2d2d44",
    "dim": "#666666",
    "accent": "#ffd93d"
  }
}
```

Hoặc qua Extension:

```typescript
api.ui.setTheme({
  name: "my-theme",
  colors: {
    background: "#1a1a2e",
    foreground: "#e6e6e6",
    // ...
  },
});
```

**Ưu điểm**:
- ✅ Dễ thay đổi
- ✅ Hot-reload (sửa file → tự động cập nhật)
- ✅ Tùy chỉnh mọi màu

**Nhược điểm**:
- ⚠️ Chỉ thay đổi màu, không thay đổi layout

---

### 10. SETTINGS MANAGER (Cấu Hình)

**Tên gọi**: Settings System / `~/.piclaw/config.json`

**Mô tả**: Cấu hình toàn cục qua file JSON.

**Cách triển khai**:

File `~/.piclaw/config.json`:

```json
{
  "model": "anthropic:claude-opus-4-5",
  "thinking": "high",
  "tools": ["read", "bash", "edit", "write", "subtool_loader", "todos"],
  "verbose": false,
  "contextLogFile": "/path/to/context.log"
}
```

**Đọc/Wirte qua API**:

```typescript
import { loadConfig, saveConfig } from "@/config/config-manager";

const config = loadConfig({});
config.model = "openai:gpt-4o";
saveConfig(config);
```

**Ưu điểm**:
- ✅ Dễ sử dụng
- ✅ Ảnh hưởng toàn cục
- ✅ Có thể override bằng CLI

**Nhược điểm**:
- ⚠️ Chỉ cấu hình sẵn có, không thêm tính năng mới

---

### 11. CONTEXT FILES (AGENTS.MD / SYSTEM PROMPT)

**Tên gọi**: Context Files / System Prompt

**Mô tả**: Chèn prompt hệ thống (system prompt) vào mọi cuộc hội thoại.

**Cách triển khai**:

File `~/.pi/agent/AGENTS.md`:

```markdown
# Coding Guidelines

- Luôn viết test trước khi code
- Dùng TypeScript strict mode
- Format code bằng prettier
- Comment rõ ràng
```

File `~/.pi/agent/SYSTEM.md` (thay thế hoàn toàn system prompt):

```markdown
Bạn là một lập trình viên chuyên nghiệp tại Google. Hãy tuân thủ...
```

Hoặc `APPEND_SYSTEM.md` (thêm vào cuối system prompt):

```markdown
## Additional Rules
- Không dùng `console.log`
- Luôn dùng type annotation
```

**Ưu điểm**:
- ✅ Ảnh hưởng mọi session
- ✅ Không cần code
- ✅ LLM luôn tuân thủ

**Nhược điểm**:
- ⚠️ Không thể có logic động
- ⚠️ Chỉ ảnh hưởng system prompt, không chặn hành vi

---

### 12. CONFIG PLUGIN (Extension Auto-Register)

**Tên gọi**: Extension Auto-Registration

**Mô tả**: Piclaw tự động đăng ký extension từ file cục bộ.

**Cách hoạt động**:

File `src/helpers.ts` → kiểm tra và ghi `settings.json`:

```typescript
await ensurePiclawExtensionRegistered(agentDir, extensionPath);
```

File `~/.piclaw/agent/settings.json`:

```json
{
  "extensions": [
    "/path/to/extension.js",
    "/path/to/another-extension.ts"
  ]
}
```

**Ưu điểm**:
- ✅ Tự động load
- ✅ Không cần cài đặt phức tạp

**Nhược điểm**:
- ⚠️ Phải ghi file settings
- ⚠️ Chỉ dùng cho extension, không phải component khác

---

### 13. SESSION HOOKS (Sự Kiện Session)

**Tên gọi**: Session Event Hooks

**Mô tả**: Chặn/sửa ở các điểm móc (hook) của session lifecycle.

**Cách triển khai**:

```typescript
api.on("session_before_switch", (event, ctx) => {
  // Chặn việc đổi session
  if (hasUnsavedWork) {
    return { cancel: true };
  }
});

api.on("session_tree", (event, ctx) => {
  // Sau khi navigate tree
  ctx.ui.notify(`Switched to ${event.newLeafId}`);
});

api.on("session_before_compact", (event, ctx) => {
  // Tùy chỉnh compaction
  event.customInstructions = "Giữ lại các import statements";
});
```

**Ưu điểm**:
- ✅ Chặn/sửa hành vi
- ✅ Có thể cancel event

**Nhược điểm**:
- ⚠️ Phải dùng Extension
- ⚠️ Chỉ có sẵn các event đã định nghĩa

---

### 14. CUSTOM MESSAGE TYPE (Tin Nhắn Tùy Chỉnh)

**Tên gọi**: Custom Message Renderer

**Mô tả**: Hiển thị message tùy chỉnh trong chat (vd: bảng, code, thông báo).

**Cách triển khai**:

```typescript
api.registerMessageRenderer("my-table-type", (message, options, theme) => {
  const data = message.content as any[][];
  return new TableComponent(theme, data);
});

// Gửi message
api.sendMessage({
  customType: "my-table-type",
  content: [["Name", "Age"], ["Alice", 30]],
  display: "Table generated",
  details: { rows: 2 },
});
```

**Ưu điểm**:
- ✅ Hiển thị phong phú
- ✅ Tích hợp UI

**Nhược điểm**:
- ⚠️ Cần code component
- ⚠️ Chỉ dùng trong chat display

---

### 15. FILE SYSTEM TOOLS (SubTool Loader)

**Tên gọi**: SubTool Loader / Unified Tool System

**Mô tả**: Chạy 50+ lệnh system qua `subtool_loader` tool.

**Cách triển khai**:

LLM có thể gọi:

```json
{
  "subtool": "git",
  "args": { "command": "status" }
}
```

Hoặc thêm tool con mới:

File `src/tools/sub-tools/my-tool.ts`:

```typescript
export async function myTool(cwd: string, args: any) {
  return {
    stdout: "...",
    stderr: "",
    code: 0,
  };
}

export const myToolMeta = {
  name: "my-tool",
  description: "My tool",
};
```

**Ưu điểm**:
- ✅ Đơn giản (chỉ cần hàm)
- ✅ LLM gọi trực tiếp
- ✅ Không cần schema phức tạp

**Nhược điểm**:
- ⚠️ Chỉ dùng cho command-line tools
- ⚠️ Phải thêm vào index

---

## 📊 BẢNG TỔNG HỢP CÁCH CAN THIỆP

| # | Tên | Phạm Vi | Độ Khó | Yêu Cầu Code | Hiệu Lực | Dùng Cho |
|---|-----|---------|---------|--------------|----------|----------|
| 1 | Extension | Toàn hệ thống | Cao | TypeScript | ⭐⭐⭐⭐⭐ | Mọi thứ |
| 2 | Skill | Workflow | Thấp | Markdown | ⭐⭐ | LLM tự dùng |
| 3 | Prompt Template | Prompt | Thấp | Markdown | ⭐⭐ | User gõ nhanh |
| 4 | Custom Tool | LLM tools | Trung | TS + Schema | ⭐⭐⭐⭐ | LLM gọi |
| 5 | Provider | Nguồn LLM | Trung | TS/JSON | ⭐⭐⭐⭐ | Đổi LLM |
| 6 | Slash Command | Lệnh `/` | Trung | TypeScript | ⭐⭐⭐ | Tương tác |
| 7 | Autocomplete | Gợi ý | Thấp | TypeScript | ⭐ | Editor UX |
| 8 | CLI Command | Đối số CLI | Thấp | TypeScript | ⭐⭐ | Khởi động |
| 9 | Theme | Giao diện | Thấp | JSON/TS | ⭐ | Trực quan |
| 10 | Settings | Cấu hình | Thấp | JSON | ⭐ | Cấu hình |
| 11 | Context File | System Prompt | Thấp | Markdown | ⭐⭐ | Prompt tĩnh |
| 12 | Config Plugin | Auto-load | Thấp | JSON | ⭐⭐ | Quản lý ext |
| 13 | Session Hook | Lifecycle | Trung | TypeScript | ⭐⭐⭐ | Kiểm soát |
| 14 | Custom Message | Chat UI | Trung | TS + UI | ⭐⭐ | Hiển thị |
| 15 | SubTool | Command-line | Thấp | Simple TS | ⭐⭐⭐ | Chạy cmd |

---

## 🎯 ĐỀ XUẤT: CÁCH NÀO DÙNG TRONG TÌNH HUỐNG NÀO?

### 1. Muốn thêm tính năng mới cho LLM (vd: đọc DB, gọi API, deploy)?
→ **Dùng Custom Tool** hoặc **Extension** (nếu phức tạp)

### 2. Muốn LLM tự động làm gì đó khi gặp ngữ cảnh?
→ **Dùng Skill** (nếu là workflow) hoặc **Extension + Event** (nếu cần thực thi)

### 3. Muốn tắt/mở tool, đổi model, cấu hình hành vi?
→ **Dùng Settings** (cục bộ) hoặc **Extension + Command** (nếu cần UI)

### 4. Muốn đổi nguồn LLM (dùng model nội bộ, API khác)?
→ **Dùng Provider** (qua Extension hoặc models.json)

### 5. Muốn can thiệp trước khi LLM nhận prompt?
→ **Dùng Extension + Event "context"** hoặc **AGENTS.md/SYSTEM.md**

### 6. Muốn chặn LLM gọi tool nào đó hoặc sửa argument?
→ **Dùng Extension + Event "tool_call"**

### 7. Muốn sửa kết quả tool sau khi LLM chạy xong?
→ **Dùng Extension + Event "tool_result"**

### 8. Muốn thêm lệnh tắt cho team dùng?
→ **Dùng Slash Command** (qua Extension)

### 9. Muốn ghi log, audit mọi hành động?
→ **Dùng Extension + Event "tool_execution_start/end"**

### 10. Muốn can thiệp khi user switch session/tree/fork?
→ **Dùng Extension + Session Events**

### 11. Muốn thay đổi giao diện (màu sắc, theme)?
→ **Dùng Theme** hoặc **Extension + UI API**

### 12. Muốn thêm component trên màn hình (status bar, widget)?
→ **Dùng Extension + UI API (setWidget, setFooter, setHeader)**

---

## 🔐 LƯU Ý VỀ BẢO MẬT

Các cách can thiệp cấp cao (**Extension, Custom Tool, Provider**) đều có quyền:
- Chạy lệnh shell (tùy chỉnh)
- Đọc/ghi file
- Mạng (gọi HTTP)
- Đổi cài đặt
- Đăng xuất/đổi LLM

**Luôn**:
- Xem code extension trước khi cài
- Không cài extension lạ từ nguồn không tin cậy
- Dùng `allowDangerousTools: false` nếu không cần
- Kiểm tra `disabledTools` trong SubTool Loader

---

## 📝 TỔNG KẾT

Piclaw cung cấp **15+ cách can thiệp** với độ sâu khác nhau:

- **Cấp nhẹ** (Markdown/JSON): Skill, Prompt Template, Theme, Settings, Context Files
- **Cấp trung** (TS đơn giản): CLI Command, SubTool, Autocomplete, Custom Message
- **Cấp sâu** (TS phức tạp): Extension, Custom Tool, Provider, Slash Command, Session Hooks

**Extension** là cách mạnh nhất - có thể làm mọi thứ nhưng đòi hỏi code.
**Skill/Template** là cách dễ nhất - chỉ cần markdown, dùng để hướng dẫn LLM.

Hệ thống được thiết kế mở, **không cần fork core** để tùy biến. Mọi thứ đều có thể thêm qua plugin/extension.

---

*Tài liệu được viết dựa trên phân tích source code Piclaw (`/home/quangtynu/Qcoder/qclaw`) và `llm-context/packages/coding-agent`*
