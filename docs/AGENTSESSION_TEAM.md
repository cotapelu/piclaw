# Self-Organizing Multi-Agent Team

## Overview

Một team các `AgentSessionRuntime` tự tổ chức để làm việc **song song** trên các tasks độc lập, dùng **shared workspace** để trao đổi thông tin.

**Key idea**: Parent runtime (LLM chính) tạo team, team tự phân chia công việc, parent đợi kết quả và tiếp tục trả lời user – **parent không được dispose** trong lúc app chạy.

## Architecture

### File Structure
```
piclaw/
├─ src/
│  ├─ team/
│  │  ├─ team-manager.ts      ← AgentTeam, bootPiclawTeam, executeTeamTasks
│  │  └─ workspace.ts         ← SharedWorkspace (collaboration space)
│  ├─ extensions/tools/
│  │  └─ team-tool.ts         ← spawn_team tool
│  └─ tests/team.test.ts      ← 8 tests
└─ docs/AGENTSESSION_TEAM.md
```

### Parent vs Children – QUAN TRỌNG!

**Parent Runtime** = LLM chính đang chat với user. Nó:
- Tạo team bằng `spawn_team()`
- Gửi bootstrap prompt cho children
- **Đợi** children làm xong
- **Tiếp tục chat** với user sau khi team xong
- **KHÔNG bao giờ dispose** trong lúc app chạy (chỉ khi app shutdown)

**Children** = Các agent worker trong team. Chúng:
- Nhận task list từ parent
- Dùng `team_ops` tool để claim task, đọc workspace, report result
- Làm việc **song song** (parallel)
- `team.dispose()` sẽ giải phóng tất cả children

**Test code** (khác với runtime):
```typescript
const parent = await bootPiclaw();  // Tạo parent
const team = await bootPiclawTeam(parent, {...});
await executeTeamTasks(team, tasks);
await team.dispose();      // Giải phóng children
await parent.dispose();   // ← TEST PHẢI DISPOSE PARENT!
// Trong app production, parent KHÔNG dispose ở đây – nó sống tiếp
```

## Key Components

### 1. SharedWorkspace

In-memory key-value store dùng để trao đổi thông tin giữa các agents.

```typescript
workspace.set("db.schema", schema, agentId);
const endpoints = workspace.get("api.endpoints");
const keys = workspace.list();
```

Conventions:
- Dùng dot notation: `"module.subkey"`
- Value có thể là string, object, array
- Ai ghi, ai đều đọc được

### 2. AgentTeam

Wrapper quản lý team:
- `runtimes`: `[parent, child1, child2, ...]` (parent ở index 0, không làm việc)
- `workspace`: SharedWorkspace instance
- `tasks`: Mảng tasks chờ xử lý
- `claimTask()`: Agent lấy task chưa ai làm (atomic)
- `reportResult()`: Ghi kết quả task
- `waitForCompletion()`: Chờ tất cả tasks xong
- `dispose()`: Chỉ dispose children (slice(1))

### 3. team_ops Tool

Công cụ mà mỗi child agent có để tương tác với team:

```typescript
{
  action: "claim_task"           → Lấy task index chưa ai làm
  action: "report_result"        → Ghi kết quả task
  action: "workspace_read"       → Đọc giá trị từ workspace
  action: "workspace_write"      → Ghi giá trị vào workspace
  action: "workspace_list"       → Liệt kê tất cả keys
}
```

**Ví dụ usage trong agent**:
```typescript
// Claim task
const { taskIndex, task } = await team_ops({ action: "claim_task" });

// Làm việc (có thể đọc workspace nếu cần)
const dbSchema = await team_ops({ action: "workspace_read", key: "db.schema" });

// Ghi kết quả
await team_ops({
  action: "report_result",
  taskIndex,
  result: "Đã tạo file x.ts với nội dung..."
});

// Nếu cần thông tin từ agent khác, đợi chúng ghi vào workspace
while (!workspace.has("api.endpoints")) {
  await sleep(100);
  // Hoặc dùng polling
}
```

## Execution Flow

### Step-by-step

1. **User hỏi**: "Làm hệ thống authentication"
2. **Parent LLM** phân tích, quyết định cần team:
   ```typescript
   await spawn_team({
     size: 3,
     roles: ["db-dev", "backend", "frontend"],
     tasks: [
       "Thiết kế Users table với email, password_hash",
       "Tạo login/register API endpoints",
       "Code React login form"
     ]
   });
   ```
3. **bootPiclawTeam()**:
   - Tạo `AgentTeam` instance với `SharedWorkspace`
   - Tạo 3 child runtimes (với `team_ops` tool)
   - Truyền workspace vào mỗi child qua context
4. **executeTeamTasks()**:
   - `team.initialize(tasks)` – đưa tasks vào team
   - Gửi **bootstrap prompt** cho mỗi child:
     ```
     You are part of a self-organizing team.
     Your role: backend
     Team tasks: [0] Thiết kế Users table..., [1] Tạo login API..., [2] Code React form...
     
     Rules:
     1. Use team_ops(action="claim_task") to get an unassigned task index
     2. Use team_ops(action="workspace_read/write") to share info
     3. After completing task, use team_ops(action="report_result")
     4. Continue until no tasks remain
     
     Start by calling team_ops with action="claim_task".
     ```
   - **Children chạy song song**:
     - Mỗi child autonomous: `claim_task → làm việc → report_result → claim lại`
     - Dùng `workspace_read` để lấy thông tin từ agent khác
     - Dùng `workspace_write` để đưa thông tin ra (ví dụ: schema, endpoints)
   - `team.waitForCompletion()` chờ đến khi tất cả tasks đã `report_result`
5. **Kết quả**: `executeTeamTasks` trả về mảng `results[]` (đúng thứ tự tasks)
6. **Parent LLM** dùng results để trả lời user
7. **team.dispose()** – giải phóng tất cả child runtimes
8. **Parent LLM tiếp tục** – vẫn còn context, sẵn sàng cho user hỏi tiếp

## Self-Organization Mechanics

### Task Claiming

- Tasks được lưu trong `team.tasks[]` với indices 0, 1, 2...
- Khi agent gọi `team_ops({ action: "claim_task" })`:
  - `team.claimTask(agentId)` tìm task index đầu tiên chưa bị assign
  - Nếu tìm thấy, mark `assignments.set(index, agentId)` và trả về index
  - Nếu hết tasks, trả về `null`
- Agent nhận task index → biết mình làm task nào

### Workspace Collaboration

**Agent không trực tiếp chat với nhau** – chỉ qua workspace.

**Ví dụ flow**:
```
Backend: task [1] "Create API"
  - Đọc workspace.get("db.schema") ← DB-dev đã ghi chưa?
  - Nếu chưa có → có thể ghi: "backend.needs" = "db.schema"
  - DB-dev (task [0]) có thể đọc và tạo schema
  - Backend đợi schema, sau khi có → code API
  - Backend ghi: workspace.set("api.endpoints", ["POST /login"], "backend")
  
Frontend: task [2] "React form"
  - Đọc workspace.get("api.endpoints") để biết endpoint URL
  - Code form
```

### Completion Detection

- `team.results[]` array khởi tạo ban đầu với `null`
- `reportResult(taskIndex, result)` → ghi vào `results[taskIndex]`
- `checkCompletion()` kiểm tra nếu tất cả `results[i] !== null`
- Nếu đầy, resolve `completionPromise` – `waitForCompletion()` tiếp tục

## Resource Management

### Who Disposes What?

| Component | Created By | Disposed By | When |
|------------|------------|-------------|------|
| Parent Runtime | App bootstrap | App shutdown / Test cleanup | Never during team execution |
| Child Runtimes | bootPiclawTeam() | `team.dispose()` | After tasks complete |
| SharedWorkspace | AgentTeam constructor | AgentTeam.dispose() | With team |
| Session files | Each runtime | `runtime.dispose()` | On dispose |

### Production vs Test

**Production app**:
```typescript
// Khởi tạo parent 1 lần khi app start
const parent = await bootPiclaw();

// Vòng lặp chat với user
while (running) {
  const userMsg = await getUserInput();
  
  if (needTeam) {
    const team = await bootPiclawTeam(parent, {...});
    const results = await executeTeamTasks(team, tasks);
    await team.dispose();  // ← Chỉ dispose children
    // parent VẪN SỐNG, context VẪN CÓ
    await sendToUser(results);
  } else {
    await parent.session.prompt(userMsg);
    await sendToUser(...);
  }
}

// Khi app shutdown
await parent.dispose();
```

**Test**:
```typescript
it("should work", async () => {
  const parent = await bootPiclaw();  // Tạo
  const team = await bootPiclawTeam(parent, {...});
  const results = await executeTeamTasks(team, tasks);
  await team.dispose();     // dispose children
  await parent.dispose();   // ← MUST dispose parent to avoid leak
  expect(results).toHaveLength(3);
});
```

**Why test needs `parent.dispose()`?**
- Mỗi test tạo parent mới → nếu không dispose → session files tồn đọng → sau nhiều test → hàng nghìn files → disk full, memory leak
- **Rule**: Test code là一次性, nên clean up hết
- Production code: parent sống lâu (whole app lifetime), không dispose sau mỗi team

## API Reference

### bootPiclawTeam(parentRuntime, options)

```typescript
interface Options {
  teamSize?: number;       // 1-4 children (default: 2)
  teamRoles?: string[];    // Role names cho từng child (default: "agent-1",...)
  tools?: string[];        // Tool allowlist
}

// Returns: AgentTeam instance
const team = await bootPiclawTeam(parentRuntime, {
  teamSize: 3,
  teamRoles: ["db", "backend", "frontend"]
});
```

### executeTeamTasks(team, tasks)

```typescript
const results = await executeTeamTasks(team, [
  "Thiết kế database schema",
  "Tạo API endpoints",
  "Viết UI components"
]);

// results: string[] – mỗi index là output của task cùng index
```

**Mechanism**:
1. `team.initialize(tasks)`
2. Gửi bootstrap prompt cho tất cả children (team.runtimes.slice(1))
3. Children tự tổ chức qua `team_ops.claim_task()`
4. `team.waitForCompletion()` – chờ tất cả tasks có result
5. Trả về `team.getResults()`

### team_ops Tool

```typescript
// Available to ALL child agents (not parent)

// 1. Claim a task
const { taskIndex, task, assignedTo } = await team_ops({
  action: "claim_task"
});

// 2. Read workspace
const value = await team_ops({
  action: "workspace_read",
  key: "db.schema"
});

// 3. Write workspace
await team_ops({
  action: "workspace_write",
  key: "api.endpoints",
  value: JSON.stringify(["POST /login", "POST /register"])
});

// 4. List keys
const { keys } = await team_ops({ action: "workspace_list" });

// 5. Report task result
await team_ops({
  action: "report_result",
  taskIndex: 0,
  result: "Đã tạo Users model với email, password_hash"
});
```

## Examples

### Example 1: Simple Auth System

```typescript
// User: "Làm authentication"
→ LLM quyết định dùng team

const team = await spawn_team({
  size: 3,
  roles: ["db", "backend", "frontend"],
  tasks: [
    "Tạo Users model với các trường email, password_hash, created_at",
    "Tạo login/register API với JWT authentication",
    "Code React login form với validation"
  ]
});

// Team tự làm:
// - DB: claim task[0] → ghi schema vào workspace.set("db.schema", ...)
// - Backend: claim task[1] → đọc db.schema → code API → ghi endpoints
// - Frontend: claim task[2] → đọc endpoints → code form

// LLM nhận kết quả: ["Model done", "API done", "Form done"]
→ Trả lời user: "Authentication system hoàn thành: DB, API, UI"
```

### Example 2: Iterative Development

```typescript
// User: "Refactor auth, thêm OAuth"
→ LLM gọi team mới (parent runtime vẫn còn context cũ)

const team = await spawn_team({
  size: 2,
  roles: ["backend", "frontend"],
  tasks: [
    "Thêm OAuth2flow vào login API, giữ JWT compatibility",
    "Update React form thêm nút 'Login with Google'"
  ]
});

// Children có thể đọc workspace cũ từ team trước? 
// ❌ Không – mỗi team có workspace riêng (temporary)
// Nếu cần context cũ, parent phải include vào tasks: 
// "Based on existing schema: {db.schema} ..."
```

## Limitations & Future Work

### Current Limitations

- **No inter-agent messaging**: Chỉ có workspace, không có direct message passing
- **No task dependencies**: Tasks phải độc lập, agent tự tính toán dependencies qua workspace polling
- **Workspace is in-memory only**: Nếu team mới, không share với team cũ
- **No progress reporting**: Parent chỉ biết kết quả cuối cùng, không biết tiến độ lõi
- **Static task assignment**: Task list cố định, không dynamic addition/removal

### Future Enhancements

- **Direct messaging**: `send_message(to, content)` + `wait_for_message()`
- **Task dependency graph**: Agent có thể declare dependencies, team scheduler đảm bảo order
- **Persistent workspace**: Lưu workspace vào DB để team mới có thể kế thừa
- **Progress streaming**: `onUpdate(agentId, taskIndex, status)` callback
- **Adaptive team size**: LLM tự điều chỉnh teamSize theo task complexity
- **Role-based access control**: Giới hạn workspace keys theo role

## Testing

8 unit tests covering:
- Team creation với roles
- Task claiming (atomic, non-reassign)
- Result reporting & completion detection
- SharedWorkspace CRUD operations
- Wait-for-completion async behavior
- Parent vs children disposal patterns

All tests pass:
```bash
npm test -- src/tests/team.test.ts
```

## Troubleshooting

### Q: Team không hoạt động, ai cũng chờ nhau?

A: Có thể do:
- Tasks quá lớn, agents không biết bắt đầu từ đâu → cần làm rõ tasks
- Workspace keys inconsistent → agents không tìm thấy thông tin
- Giải pháp: Tasks nên explicit về inputs/outputs, e.g., "Task A: tạo schema → ghi workspace key 'db.schema'"

### Q: Parent runtime leak resources?

A: Trong production, parent được dispose khi app shutdown. Nếu chạy nhiều app instances (e.g., tests), phải đảm bảo `await parent.dispose()` trong `finally` block.

### Q: Children có thể sửa file của nhau không?

A: Không có file locking. Mỗi child có thể sửa bất kỳ file nào (vì cùng cwd). Để tránh conflict:
- Tasks nên định rõ files/folders ai làm
- Hoặc dùng workspace để announce: "Tôi đang sửa file X"
- Future: có thể thêm file locking mechanism

### Q: Team size tối đa bao nhiêu?

A: `MAX_TEAM_SIZE = 4` (trong `validateOptions`). Có thể điều chỉnh, nhưng càng nhiều agents thì:
- Tốn token hơn (nhiều LLM instances)
- Có thể gặp rate limit
- Workspace coordination phức tạp hơn

## Summary

- **Parent** = LLM chính, không dispose trong team execution
- **Children** = Workers, tự organize qua `team_ops` + `workspace`
- **Workflow**: `claim → do work (read workspace) → write result → repeat`
- **Dispose**: `team.dispose()` chỉ dispose children; test phải dispose parent riêng
- **No communication** trực tiếp giữa agents – chỉ qua workspace
- **Parallel execution** tăng throughput cho independent tasks
