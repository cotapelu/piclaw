# AgentSession Team - LLM Autonomous Multi-Agent System

## Overview

Multi-agent system cho phép LLM **tự động quyết định** khi nào cần tạo team agents để thực hiện công việc đồng thời.

## Architecture

### File Structure
```
piclaw/
├─ src/
│  ├─ piclaw-core.ts          ← bootPiclaw() cho single agent (không đổi)
│  ├─ team/
│  │  └─ team-manager.ts      ← bootPiclawTeam, executeTeamTasks
│  ├─ extensions/tools/
│  │  └─ team-tool.ts         ← spawn_team extension tool  
│  └─ tests/team.test.ts      ← 7 unit tests
└─ docs/AGENTSESSION_TEAM.md  ← Documentation này
```

### Core Changes (piclaw-core.ts)
- Refactored factory pattern - sạch hơn, dùng `createAgentSessionRuntime()`
- Thêm export: `bootPiclawTeam`, `executeTeamTasks`, `AgentTeamRuntime`, `TeamExecutionMode`
- Single agent flow không thay đổi - vẫn hoạt động như cũ

## How It Works

### For LLM (Using spawn_team tool)
```typescript
// LLM tự quyết định dùng team khi nào
if (manyIndependentTasks) {
  spawn_team({
    size: 3,
    tasks: ["task1", "task2", "task3"],
    roles: ["researcher", "coder", "reviewer"]
  })
}
```

### Execution Flow
1. **LLM calls spawn_team** → extension tool xử lý
2. **bootPiclawTeam()** tạo N agent runtimes độc lập
3. **executeTeamTasks()** chạy song song/sequential
4. **dispose()** giải phóng tài nguyên ngay lập tức

## Team Architecture (Enhanced Hybrid)

### Shared Services (Thread-safe, read-mostly)
- AuthStorage - authentication state
- ModelRegistry - model catalog
- SettingsManager - project settings

### Per-Agent (Isolated state)
- SessionManager.inMemory() - riêng biệt
- ResourceLoader - files/tool config
- AgentSession - conversation history

## Usage Scenarios

### Scenario 1: Complex Project
```
User: "Build complete e-commerce website"
LLM: spawn_team({
  size: 3,
  roles: ["frontend", "backend", "devops"],
  tasks: [
    "Design React components",
    "Create Node.js API", 
    "Setup Docker deployment"
  ]
})
```

### Scenario 2: Code Analysis + Implementation
```
User: "Refactor authentication system"
LLM: spawn_team({
  size: 2,
  tasks: [
    "Analyze current auth code",
    "Implement new JWT system"
  ]
})
```

### Scenario 3: Review & Quality
```
LLM: spawn_team({
  size: 2,
  tasks: [
    "Check code for vulnerabilities",
    "Review performance bottlenecks"
  ]
})
```

## Technical Details

### Memory & Performance
- Team chỉ tồn tại trong thời gian thực thi
- Tự động dispose sau khi hoàn thành
- Không ảnh hưởng khi không dùng (0 overhead)

### Error Handling
- Agent failure → LLM retry với agent khác
- Timeout → LLM giảm team size
- Resource limit → LLM tự điều chỉnh

## API Reference

### bootPiclawTeam(options)
```typescript
options = {
  cwd?: string,        // Working directory
  teamSize?: number,   // 1-5 agents (default: 3)
  teamRoles?: string[], // Optional role names
  tools?: string[],    // Tool names to include
}
```

### executeTeamTasks(team, tasks, mode)
```typescript
mode: "parallel" | "sequential"  // Default: parallel
// Distributes tasks evenly across agents
```

### spawn_team tool
```typescript
// Available to LLM via extension
{
  name: "spawn_team",
  params: {
    size: number,      // Agents 1-5
    tasks: string[],   // Required
    roles: string[],   // Optional
    mode: string       // "parallel" | "sequential"
  }
}
```

## Testing

- 7 unit tests covering team creation, roles, disposal, shared services
- All tests pass: `npx vitest run src/tests/team.test.ts`

## Future Enhancements

- Collaborative mode (agents communicate)
- Persistent team sessions
- Team size auto-tuning based on task complexity
- Progress streaming via TUI