# AgentSession Team Implementation

## Tổng quan

AgentSession Team cho phép chạy nhiều AgentSession đồng thời cho cùng một dự án, mỗi agent làm việc độc lập nhưng chia sẻ cấu hình cơ bản.

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|-----------|---------|
| AgentSession Team | Nhóm các AgentSession chạy song song |
| Team Factory | Factory function tạo session cho toàn bộ team |
| Session Isolation | Mỗi session duy trì state độc lập |
| Shared Services | Các service được chia sẻ giữa sessions |

## Architecture Overview

```
bootPiclawTeam()
├── createTeamFactory()          # Tạo factory chung cho team
│   ├── createAgentSessionServices()  # Tạo services cho mỗi session
│   └── createAgentSessionFromServices() # Tạo AgentSession
└── createAgentSessionRuntime()      # Khởi tạo runtime cho từng agent
```

## Implementation Approaches

### Approach 1: Shared Factory (Recommended)

**Ưu điểm:**
- Session isolation hoàn toàn
- Không xung đột state
- Dễ quản lý lifecycle

**Nhược điểm:**
- Tốn memory hơn (mỗi session có services riêng)

```typescript
// src/piclaw-core.ts
async function createTeamFactory(cwd: string, agentDir: string, options: PiclawCoreOptions) {
  return async ({sessionManager, sessionStartEvent}) => {
    const services = await createAgentSessionServices({
      cwd, agentDir,
      extensionFlagValues: options.extensionFlagValues,
      resourceLoaderOptions: options.resourceLoaderOptions,
    });

    const result = await createAgentSessionFromServices({
      services, sessionManager, sessionStartEvent,
      tools: options.tools,
      customTools: options.customTools,
    });

    return {
      ...result,
      services,
      diagnostics: services.diagnostics,
    };
  };
}

export async function bootPiclawTeam(options: PiclawCoreOptions & {teamSize?: number}) {
  const cwd = options.cwd ?? process.cwd();
  const agentDir = options.agentDir ?? getAgentDir();
  const teamSize = options.teamSize ?? 3;

  const factory = await createTeamFactory(cwd, agentDir, options);

  const runtimes = await Promise.all(
    Array.from({length: teamSize}, () =>
      createAgentSessionRuntime(factory, {
        cwd, agentDir,
        sessionManager: SessionManager.inMemory(),
        sessionStartEvent: {type: "session_start", reason: "team"},
      })
    )
  );

  return runtimes;
}
```

### Approach 2: Shared Services Pool

**Ưu điểm:**
- Giảm memory usage
- Chia sẻ auth/models

**Nhược điểm:**
- Risk xung đột state
- Khó quản lý isolation

### Approach 3: Hybrid

Chia sẻ auth storage nhưng services riêng.

## Usage

```typescript
// Tạo team 3 agents
const team = await bootPiclawTeam({
  teamSize: 3,
  model: "openai:gpt-4",
  tools: ["read", "bash", "edit", "write"],
});

// Mỗi agent làm việc độc lập
await Promise.all([
  team[0].prompt("Design API structure"),
  team[1].prompt("Implement authentication"),
  team[2].prompt("Write unit tests"),
]);

// Kiểm tra kết quả
for (let i = 0; i < team.length; i++) {
  console.log(`Agent ${i}: ${team[i].messages.length} messages`);
}
```

## Team Management API

```typescript
// Gửi prompt đồng thời cho tất cả agents
await Promise.all(
  team.map(runtime => runtime.prompt("Analyze this code"))
);

// Lấy kết quả từ từng agent
const results = team.map(runtime => ({
  messages: runtime.session.messages,
  sessionId: runtime.session.sessionId,
}));

// Dọn dẹp team
for (const runtime of team) {
  await runtime.dispose();
}
```

## Best Practices

1. **Sử dụng In-Memory Sessions**: Đối với team, dùng `SessionManager.inMemory()` để tránh xung đột
2. **Gán Task Rõ Ràng**: Mỗi agent nên có vai trò cụ thể
3. **Kiểm Tra Kết Quả**: Thu thập kết quả từ tất cả agents
4. **Dọn Dẹp**: Gọi `dispose()` khi team hoàn thành

## Troubleshooting

**Lỗi: Out of memory**
- Giảm `teamSize`
- Sử dụng Hybrid approach để chia sẻ services

**Lỗi: Race condition**
- Kiểm tra task assignment
- Đảm bảo mỗi agent có workspace riêng

**Lỗi: Extension conflicts**
- Sử dụng shared factory để tạo sessions
- Tránh chia sẻ extension state