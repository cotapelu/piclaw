# AgentSession Team Implementation (Enhanced Hybrid)

## 📋 Tổng quan

AgentSession Team cho phép chạy nhiều AgentSession đồng thời cho cùng một dự án, mỗi agent làm việc độc lập nhưng chia sẻ cấu hình cơ bản.

### Kiến trúc Enhanced Hybrid

```
bootPiclawTeam()
├── Shared Layer (chia sẻ giữa tất cả agents):
│   ├── AuthStorage (credentials)
│   ├── ModelRegistry (mô hình AI)
│   └── SettingsManager (cấu hình project)
│
└── Per-Agent Layer (riêng cho mỗi agent):
    ├── AgentSessionRuntime
    │   ├── AgentSession (messages, state)
    │   ├── SessionManager.inMemory() (session riêng)
    │   ├── ResourceLoader (context files, skills)
    │   └── ExtensionRunner (extension context)
    └── Diagnostics
```

## 🔧 API Reference

### PiclawCoreOptions (mở rộng)

```typescript
export interface PiclawCoreOptions {
  // ... existing options ...
  
  /** Số lượng agents trong team (default: 1) */
  teamSize?: number;
  
  /** Tên/giá trị vai trò cho từng agent (optional) */
  teamRoles?: string[];
}
```

### AgentTeamRuntime

```typescript
/** Kết quả từ bootPiclawTeam */
export interface AgentTeamRuntime {
  /** Mảng các AgentSessionRuntime */
  runtimes: AgentSessionRuntime[];
  
  /** Thông tin các agent */
  agents: Array<{
    id: number;
    role?: string;
    sessionId: string;
    messages: AgentMessage[];
  }>;
  
  /** Dọn dẹp team */
  dispose: () => Promise<void>;
}
```

## 🏗️ Implementation Details

### File: `src/piclaw-core.ts`

```typescript
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
  AgentSessionRuntime,
  createAgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "./config/config.js";
import { getDefaultContextLogFile } from "./config/config-manager.js";
import { createSubLoaderToolDefinition } from "./tools/subtool-loader.js";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { createContextLoggingStreamFn } from "./context-logger.js";
import { join } from "node:path";

// ... existing bootPiclaw function ...

/**
 * Tạo team nhiều agents cho cùng dự án.
 * 
 * Enhanced Hybrid Approach:
 * - SHARED: AuthStorage, ModelRegistry, SettingsManager (read-only during runtime)
 * - PER-AGENT: ResourceLoader, SessionManager, AgentSession (state isolation)
 */
export async function bootPiclawTeam(
  options: PiclawCoreOptions = {}
): Promise<AgentTeamRuntime> {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();
  const teamSize = options.teamSize ?? 3;
  const teamRoles = options.teamRoles ?? [];

  // 1. CREATE SHARED SERVICES (thread-safe, read-mostly)
  const sharedAuthStorage = AuthStorage.create(join(agentDir, "auth.json"));
  const sharedModelRegistry = ModelRegistry.create(
    sharedAuthStorage,
    join(agentDir, "models.json")
  );
  const sharedSettingsManager = SettingsManager.create(cwd, agentDir);

  // 2. CREATE FACTORY FUNCTION
  const createRuntimeFactory: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    // Each agent gets its own ResourceLoader
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager: sharedSettingsManager,
    });

    await resourceLoader.reload();

    const customTools = options.customTools ?? [createSubLoaderToolDefinition(cwd)];

    const result = await createAgentSessionFromServices({
      services: {
        cwd,
        agentDir,
        authStorage: sharedAuthStorage, // SHARED
        modelRegistry: sharedModelRegistry, // SHARED
        settingsManager: sharedSettingsManager, // SHARED
        resourceLoader, // PER-AGENT
        diagnostics: [],
      },
      sessionManager, // PER-AGENT (inMemory)
      sessionStartEvent,
      tools: options.tools,
      customTools,
    });

    return {
      ...result,
      services: {
        cwd,
        agentDir,
        authStorage: sharedAuthStorage,
        modelRegistry: sharedModelRegistry,
        settingsManager: sharedSettingsManager,
        resourceLoader,
        diagnostics: [],
      },
      diagnostics: [],
    };
  };

  // 3. CREATE MULTIPLE RUNTIMES
  const runtimes: AgentSessionRuntime[] = [];

  for (let i = 0; i < teamSize; i++) {
    const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
      cwd,
      agentDir,
      sessionManager: SessionManager.inMemory(cwd), // In-memory for isolation
      sessionStartEvent: {
        type: "session_start",
        reason: "team",
        agentIndex: i,
        role: teamRoles[i],
      } as any,
    });

    runtimes.push(runtime);
  }

  // 4. RETURN TEAM RUNTIME
  return {
    runtimes,
    agents: runtimes.map((rt, index) => ({
      id: index,
      role: teamRoles[index],
      sessionId: rt.session.sessionId,
      messages: rt.session.messages,
    })),
    async dispose() {
      await Promise.all(runtimes.map(rt => rt.dispose()));
    },
  };
}

// Type export
export interface AgentTeamRuntime {
  runtimes: AgentSessionRuntime[];
  agents: Array<{
    id: number;
    role?: string;
    sessionId: string;
    messages: any[];
  }>;
  dispose: () => Promise<void>;
}
```

## 💻 Usage Examples

### Basic Team Usage

```typescript
import { bootPiclawTeam } from "./piclaw-core.js";

// Tạo team 3 agents
const team = await bootPiclawTeam({
  teamSize: 3,
  model: "openai:gpt-4",
  tools: ["read", "bash", "edit", "write"],
});

// Mỗi agent làm việc độc lập
try {
  await Promise.all([
    team.runtimes[0].session.prompt("Design API structure"),
    team.runtimes[1].session.prompt("Implement authentication"),
    team.runtimes[2].session.prompt("Write unit tests"),
  ]);
} finally {
  // Dọn dẹp
  await team.dispose();
}
```

### With Roles

```typescript
const team = await bootPiclawTeam({
  teamSize: 3,
  teamRoles: ["architect", "coder", "reviewer"],
  model: "anthropic:claude-opus-4-5",
});

// Gửi prompt cho từng agent
for (const agent of team.agents) {
  const runtime = team.runtimes[agent.id];
  
  switch (agent.role) {
    case "architect":
      await runtime.session.prompt("Design the system architecture");
      break;
    case "coder":
      await runtime.session.prompt("Implement the design");
      break;
    case "reviewer":
      await runtime.session.prompt("Review the implementation");
      break;
  }
}
```

## 📊 Memory Analysis

### Memory Footprint Comparison

| Approach | Memory per Agent | 3 Agents Total | Notes |
|----------|------------------|----------------|-------|
| Full Isolation | ~20MB | ~60MB | Maximum safety |
| Enhanced Hybrid | ~7MB | ~25MB | Recommended |
| Shared Pool | ~3MB | ~12MB | Risk of conflicts |

### Breakdown (Enhanced Hybrid)

- Shared Services: ~5MB (1x)
- Per-Agent Services: ~7MB × N agents
- Total: 5MB + (7MB × N)

## ⚙️ Configuration

### Team-Specific Settings

Các settings sau đây được SHARED giữa các agents:

- `auth.json` - API keys
- `models.json` - Model registry  
- `settings.json` - Project settings

Mỗi agent có:
- `ResourceLoader` riêng - tải context files, skills
- `SessionManager.inMemory()` - session không lưu file
- `ExtensionRunner` riêng - extension context

## 🛡️ Best Practices

1. **Sử dụng In-Memory Sessions**: `SessionManager.inMemory()` để tránh xung đột
2. **Gán Vai trò Rõ ràng**: Mỗi agent nên có vai trò cụ thể
3. **Kiểm tra Kết quả**: Thu thập kết quả từ tất cả agents
4. **Dọn dẹp**: Luôn gọi `team.dispose()` khi hoàn thành
5. **Xử lý Lỗi**: Mỗi agent độc lập, lỗi agent này không ảnh hưởng agent khác

## 🚨 Troubleshooting

### Lỗi: Out of memory

- Giảm `teamSize`
- Kiểm tra memory leak trong extensions

### Lỗi: Race condition

- Mỗi agent có workspace riêng
- Không chia sẻ file writes giữa agents

### Lỗi: Extension conflicts

- Sử dụng shared factory để tạo sessions
- Extensions chỉ read-only trên shared resources

## 🔄 Migration from Single Agent

### Before (Single Agent)

```typescript
const runtime = await bootPiclaw({
  model: "openai:gpt-4",
});
await runtime.session.prompt("Do something");
```

### After (Team)

```typescript
const team = await bootPiclawTeam({
  teamSize: 2,
  model: "openai:gpt-4",
});
await Promise.all(
  team.runtimes.map(rt => rt.session.prompt("Do something"))
);
await team.dispose();
```

## 📈 Performance Targets

- Team creation time: < 5 seconds (3 agents)
- Memory usage: < 30MB (3 agents, Enhanced Hybrid)
- Response time: No degradation vs single agent
- Isolation: 100% state separation