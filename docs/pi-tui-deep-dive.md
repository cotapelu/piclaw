# 🖥️ Kiến Trúc TUI: Cách PiCodingAgent Tích Hợp PiTUI

*Tài liệu chi tiết cách `pi-coding-agent` sử dụng `pi-tui` để xây dựng giao diện terminal tương tác*

---

## 🔍 Tổng Quan

`@mariozechner/pi-tui` cung cấp hệ thống giao diện terminal (TUI) dạng component, tương tự React nhưng dành cho terminal. `pi-coding-agent` sử dụng nó để xây dựng CLI interface chuyên nghiệp, mượt mà cho AI coding assistant.

### Mối Quan Hệ
```
pi-tui (Component framework)
    ↓
    └───> pi-coding-agent (Dùng để build CLI)
               ├─ InteractiveMode (trình điều khiển)
               ├─ AssistantMessage (hiển thị LLM response)
               ├─ ToolExecution (hiển thị tool calls)
               └─ UserMessageSelector (nhập lệnh)
```

---

## 1. 🚀 Khởi Động Chế Độ Interactive (InteractiveMode)

**File:** `src/modes/interactive/interactive-mode.ts`

Đây là nơi TUI được sinh ra và "bật" lên:

```typescript
export class InteractiveMode {
  private tui: TUI;
  private terminal: ProcessTerminal;

  async run() {
    // 1️⃣ Tạo terminal process (chế độ raw, không echo input)
    this.terminal = new ProcessTerminal();
    
    // 2️⃣ Khởi tạo TUI
    this.tui = new TUI(this.terminal, settingsManager.getShowHardwareCursor());
    
    // 3️⃣ Cấu hình clear on shrink (giảm nhấp nháy)
    this.tui.setClearOnShrink(settingsManager.getClearOnShrink());
    
    // 4️⃣ ⭐️ Thêm Component con vào cây TUI
    this.setupUIComponents();
    
    // 5️⃣ Set focus mặc định
    this.tui.setFocus(this.messageSelector);
    
    // 6️⃣ Vẽ màn hình lần đầu
    this.tui.requestRender();
    
    // 7️⃣ Lắng nghe input từ terminal
    this.tui.start();
  }
}
```

---

## 2. 🧩 Setup Cây Component (UI Hierarchy)

**File:** `src/modes/interactive/interactive-mode.ts`

Cấu trúc cây component được dựng lên:

```typescript
private setupUIComponents() {
  // 🏗️ Panel gốc chứa toàn bộ UI
  const mainPanel = new Panel({
    direction: 'vertical',
    children: [
      // Header: thông tin hệ thống
      new StatusBarComponent({ tui: this.tui }),
      
      // Body: lịch sử hội thoại
      new AssistantMessageComponent({ tui: this.tui }),
      
      // Footer: khung nhập lệnh
      new UserMessageSelectorComponent({ tui: this.tui }),
    ],
  });

  // Thêm vào TUI
  this.tui.addChild(mainPanel);
}
```

**Cây phân cấp:**
```
TUI (root)
└── Panel (vertical)
    ├── StatusBarComponent       [Model: gpt-4, Branch: main]
    ├── AssistantMessageComponent
    │   ├── [User] Hello!
    │   └── [AI] How can I help?
    └── UserMessageSelectorComponent
        > 💬 [type here...]
```

---

## 3. 📡 Đồng Bộ Trạng Thái Từ Core (AgentSession)

Khi `pi-agent-core` phát ra các sự kiện (events), TUI cần cập nhật để hiển thị.

**File:** `src/core/agent-session.ts`

```typescript
private async processEvents(event: AgentEvent): Promise<void> {
  switch (event.type) {
    case "message_start":
      // 👉 Stream bắt đầu
      this.tui?.emit('message_update', { 
        type: 'stream_start', 
        message: event.message 
      });
      break;

    case "message_update":
      // 👉 Token mới từ LLM
      this.tui?.emit('message_update', { 
        type: 'chunk', 
        content: event.message.content 
      });
      break;

    case "tool_execution_start":
      // 👉 Hiển thị: [RUNNING] bash ls -la
      this.tui?.emit('tool_start', { 
        toolName: event.toolName, 
        args: event.args 
      });
      break;

    case "tool_execution_end":
      // 👉 Hiển thị: [SUCCESS] ✓
      this.tui?.emit('tool_end', { 
        toolName: event.toolName, 
        result: event.result 
      });
      break;

    case "turn_end":
      // 👉 Luân phiên kết thúc
      this.tui?.emit('turn_complete');
      break;
  }
  
  // 🔥 Yêu cầu TUI vẽ lại
  this.tui?.requestRender();
}
```

---

## 4. 🖥️ Component: Chế Độ Nhập Lệnh (UserMessageSelector)

**File:** `src/modes/interactive/components/user-message-selector.ts`

Cho phép người dùng nhập multi-line lệnh với syntax highlighting cơ bản:

```typescript
export class UserMessageSelectorComponent extends CustomEditor {
  constructor(private tui: TUI) {
    super({
      tui,
      placeholder: '💡 Nhập lệnh tại đây (Ctrl+Enter để gửi)...',
      onSubmit: async (text: string) => {
        // Gửi xuống pi-agent-core xử lý
        await this.agentSession.prompt(text);
        this.clear();  // Xóa khung nhập
      },
      onCancel: () => {
        this.tui?.emit('input_cancelled');
      },
      isMultiLine: true,  // Cho phép xuống dòng
      history: this.getCommandHistory(),  // Lịch sử lệnh
    });
  }

  render() {
    const border = '─'.repeat(60);
    return `
      ┌── Prompt ──────────────────────────────────────┐
      │ ${this.value || this.placeholder}              │
      └── ${border}───────────────────────────────────┘
    `;
  }
}
```

**Tính năng:**
- Chế độ multi-line (Enter xuống dòng, Ctrl+Enter gửi)
- Lịch sử lệnh (mũi tên lên/xuống)
- Tab completion (gợi ý lệnh)
- Syntax highlighting cơ bản

---

## 5. 🎛️ Phím Tắt Toàn Cục (Keybindings)

**File:** `src/modes/interactive/interactive-mode.ts`

Cấu hình các shortcut:

```typescript
import { KeybindingsManager } from '@mariozechner/pi-tui';

const keybindings = new KeybindingsManager();

// Dừng lệnh đang chạy
keybindings.register('ctrl+c', () => {
  this.agentSession?.abort();
  this.tui?.showToast('Đã dừng lệnh');
});

// Mở menu chọn model (Ctrl+P)
keybindings.register('ctrl+p', () => {
  this.openModelSelector();
});

// Tái sinh câu trả lời (Ctrl+R)
keybindings.register('ctrl+r', () => {
  this.agentSession?.continue();
});

// Mở cài đặt (Ctrl+,)
keybindings.register('ctrl+,', () => {
  this.openSettings();
});

// History tìm kiếm (Ctrl+F)
keybindings.register('ctrl+f', () => {
  this.openSearchHistory();
});

// Gắn vào TUI
this.tui.setKeybindings(keybindings);
```

---

## 6. 💬 Component: Hiển Thị Trả Lời Của AI

**File:** `src/modes/interactive/components/assistant-message.ts`

Hiển thị "bong bóng" chat của AI với streaming theo thời gian thực:

```typescript
export class AssistantMessageComponent extends Component {
  private streamingText = '';
  private isStreaming = false;

  // Gọi từ core mỗi khi LLM phát ra token mới
  streamUpdate(textChunk: string) {
    this.streamingText += textChunk;
    this.isStreaming = true;
    
    // 🎯 Yêu cầu vẽ lại ngay lập tức
    this.tui?.requestRender();
  }

  onMessageEnd() {
    this.isStreaming = false;
    this.tui?.requestRender();
  }

  render() {
    const header = '\x1b[36m🤖 Assistant\x1b[0m';
    const content = this.formatText(this.streamingText);
    const indicator = this.isStreaming ? '\n[ ... đang nhập ]' : '';
    
    return `
      ${this.drawBorder('Response')}
      ${header}
      ${content}
      ${indicator}
      ${this.drawBorderEnd()}
    `;
  }

  private formatText(text: string): string {
    // Tự động xuống dòng, highlight code blocks
    return text
      .replace(/```(\w+)?\n([\s\S]*?)```/g, this.highlightCode)
      .replace(/\*\*(.*?)\*\*/g, '\x1b[1m$1\x1b[0m');  // Bold
  }
}
```

**Hiệu ứng:**
- Text hiện lên từng ký tự (như người thật đang gõ)
- Code blocks được tô màu riêng
- Có dấu ba chấm nhấp nháy khi đang stream

---

## 7. ⚙️ Component: Thực Thi Công Cụ (ToolExecution)

**File:** `src/modes/interactive/components/tool-execution.ts`

Hiển thị trạng thái chạy tool:

```typescript
export class ToolExecutionComponent extends Component {
  render() {
    const tool = this.toolName;
    const args = JSON.stringify(this.args);
    
    switch (this.status) {
      case 'pending':
        return `
          ⏳ [PENDING] ${tool} ${args}
          ──────────────────────────
        `;
        
      case 'running':
        return `
          🔄 [RUNNING] ${tool} ${args}
          ⏱️ ${this.elapsedTime}ms
        `;
        
      case 'success':
        return `
          ✅ [SUCCESS] ${tool} (${this.duration}ms)
          Output: ${this.result.content}
        `;
        
      case 'error':
        return `
          ❌ [ERROR] ${tool}
          ${this.errorMessage}
        `;
    }
  }
}
```

---

## 8. ⚡ Cách Tối Ưu Hiệu Năng (Differential Rendering)

TUI không vẽ lại toàn bộ màn hình mỗi lần. Thay vào đó, nó tính toán sự khác biệt:

```typescript
// Trong TUI core (core/render.js)
class Renderer {
  private previousFrame: string = '';

  render(root: Component) {
    // 1. Render ra chuỗi mới
    const newFrame = root.render();

    // 2. Tính diff
    const diff = Diff.calculate(this.previousFrame, newFrame);

    // 3. Chỉ gửi phần thay đổi xuống terminal
    //    (VD: "dòng 15 cột 10: thay '0' thành '1')
    this.terminal.applyMinimalUpdate(diff);

    // 4. Lưu lại
    this.previousFrame = newFrame;
  }
}
```

**Tại sao quan trọng?**
- Không bị nhấp nháy (flicker)
- Nhanh hơn (terminal I/O chậm)
- Không bị "cướp" focus từ người dùng

---

## 9. 🎨 Theme & Styling

TUI có hệ thống theme cho phép đổi màu sắc:

```typescript
// Áp dụng theme Dark Mode
this.tui.setTheme('dark', {
  colors: {
    background: '#1a1a2e',
    foreground: '#e6e6e6',
    primary: '#00d4aa',      // Màu xanh cyan cho AI
    secondary: '#ff6b6b',    // Màu đỏ cho lỗi
    border: '#2d2d44',
  }
});
```

Các component tự động nhận theme thông qua `this.tui.getTheme()`.

---

## 10. 🏁 Kết Luận: Mô Hình Tích Hợp

### Luồng Dữ Liệu (Data Flow)

```
1. User nhập lệnh
   ↓
2. UserMessageComponent gửi xuống Agent (pi-agent-core)
   ↓
3. Agent gọi LLM thông qua streamFn
   ↓
4. LLM trả về tokens (streaming)
   ↓
5. Agent phát ra AgentEvent (message_update)
   ↓
6. AgentSession bắt event, emit lên TUI
   ↓
7. AssistantMessageComponent nhận và vẽ (real-time)
   ↓
8. Nếu có tool call → ToolExecutionComponent hiện [RUNNING]
   ↓
9. Tool chạy xong → cập nhật trạng thái [SUCCESS/ERROR]
```

### Ưu Điểm Của Kiến Trúc Này

| Ưu điểm | Giải thích |
|---------|------------|
| **Declarative** | Chỉ định *muốn gì*, không lo *vẽ sao* |
| **Component-based** | Tái sử dụng UI (Button, List, Input...) |
| **Event-driven** | Update tự động khi state thay đổi |
| **Real-time** | Stream token từng ký tự không độ trễ |
| **Optimized** | Diff rendering không bị giật |
| **Extensible** | Thêm component mới dễ dàng |

### So Sánh Với Các Cách Khác

- ❌ **Inquirer.js**: Chỉ làm được dạng Q&A đơn giản, không multi-line tốt
- ❌ **Console.log**: Không kiểm soát được, bị nhấp nháy, không có layout
- ✅ **PiTUI**: Full component, layout engine, focus manager, real-time streaming

---

## 🔗 Tham Khảo Thêm

- `src/modes/interactive/interactive-mode.ts` - Khởi tạo TUI
- `src/modes/interactive/components/` - Các component cụ thể
- `node_modules/@mariozechner/pi-tui/dist/` - Source TUI framework
- `src/core/agent-session.ts` - Cách emit event lên TUI

---

**Kết:** Việc tích hợp TUI làm cho PiClaw có giao diện chuyên nghiệp, mượt mà, mang lại trải nghiệm người dùng (UX) gần giống như một ứng dụng desktop thực thụ, nhưng chạy hoàn toàn trong terminal! 🚀
