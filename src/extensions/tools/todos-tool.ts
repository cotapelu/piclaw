#!/usr/bin/env node
/**
 * Simple Todo Tool - Core operations only
 * - 6 ops: replace, add_phase, add_task, update, remove_task, list
 * - Auto-normalize: one in_progress task
 * - File persistence: ./.piclaw/agent/todos.json
 * - System messages + auto-continue
 */

import { existsSync, mkdirSync, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { ToolDefinition, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { Static } from "typebox";
import { Text } from "@mariozechner/pi-tui";

// ============================================================================
// Types
// ============================================================================

export type TodoStatus = "pending" | "in_progress" | "completed" | "abandoned";

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  notes?: string;
  details?: string;
}

export interface TodoPhase {
  id: string;
  name: string;
  tasks: TodoItem[];
}

export interface TodoFile {
  phases: TodoPhase[];
  nextTaskId: number;
  nextPhaseId: number;
}

interface PersistedTodo {
  version: 1;
  phases: TodoPhase[];
  nextTaskId: number;
  nextPhaseId: number;
  updatedAt: string;
}

export interface TodoToolDetails {
  phases: TodoPhase[];
  storage: string;
  error?: string;
}

// ============================================================================
// Schemas
// ============================================================================

const StatusEnum = Type.String();

const InputTask = Type.Object({
  content: Type.String(),
  status: Type.Optional(StatusEnum),
  notes: Type.Optional(Type.String()),
  details: Type.Optional(Type.String()),
});

const InputPhase = Type.Object({
  name: Type.String(),
  tasks: Type.Optional(Type.Array(InputTask)),
});

const todoWriteSchema = Type.Object({
  replace: Type.Optional(Type.String()),
  add_phase: Type.Optional(Type.String()),
  add_task: Type.Optional(Type.String()),
  update: Type.Optional(Type.String()),
  remove_task: Type.Optional(Type.String()),
  list: Type.Optional(Type.String()),
});

type TodoWriteParams = Static<typeof todoWriteSchema>;

// ============================================================================
// File I/O
// ============================================================================

const TODO_FILE_NAME = ".piclaw/agent/todos.json";
const filePath = join(process.cwd(), TODO_FILE_NAME);

async function loadTodoFromFile(): Promise<TodoFile | null> {
  if (!existsSync(filePath)) return null;
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed: PersistedTodo = JSON.parse(content);
    if (parsed.version !== 1) return null;
    return { phases: parsed.phases, nextTaskId: parsed.nextTaskId, nextPhaseId: parsed.nextPhaseId };
  } catch (e) {
    console.error("Load todos failed:", e);
    return null;
  }
}

async function saveTodoToFile(todo: TodoFile): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
  const persisted: PersistedTodo = { version: 1, phases: todo.phases, nextTaskId: todo.nextTaskId, nextPhaseId: todo.nextPhaseId, updatedAt: new Date().toISOString() };
  await fs.writeFile(filePath, JSON.stringify(persisted, null, 2));
}

// ============================================================================
// Helpers
// ============================================================================

function clonePhases(phases: TodoPhase[]): TodoPhase[] {
  return phases.map(p => ({ ...p, tasks: p.tasks.map(t => ({ ...t })) }));
}

function findTask(phases: TodoPhase[], id: string): TodoItem | undefined {
  for (const phase of phases) {
    const task = phase.tasks.find(t => t.id === id);
    if (task) return task;
  }
  return undefined;
}

function buildPhaseFromInput(input: { name: string; tasks?: any[] }, phaseId: string, nextTaskId: number): { phase: TodoPhase; nextTaskId: number } {
  const tasks: TodoItem[] = [];
  let tid = nextTaskId;
  for (const t of input.tasks || []) {
    tasks.push({ id: `task-${tid++}`, content: t.content, status: t.status || "pending", notes: t.notes, details: t.details });
  }
  return { phase: { id: phaseId, name: input.name, tasks }, nextTaskId: tid };
}

// ============================================================================
// Normalization - Handle common LLM output errors
// ============================================================================

function normalizeParams(params: any): any {
  // Handle string input (JSON string)
  if (typeof params === "string") {
    try { params = JSON.parse(params); } catch (e) {
      throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (typeof params !== "object" || params === null) {
    throw new Error("Params must be object");
  }

  const p = { ...params };

  // Parse stringified operation values
  if (p.add_phase && typeof p.add_phase === "string") {
    try { p.add_phase = JSON.parse(p.add_phase); } catch { p.add_phase = null; }
  }
  if (p.replace?.phases && typeof p.replace.phases === "string") {
    try { p.replace.phases = JSON.parse(p.replace.phases); } catch { p.replace = null; }
  }

  // Handle add_phase.name being a stringified object (LLM puts whole object in name)
  if (p.add_phase && typeof p.add_phase === "object") {
    const ap = p.add_phase as any;
    if (ap.name && typeof ap.name === "string" && ap.name.startsWith("{")) {
      try {
        const parsed = JSON.parse(ap.name);
        if (parsed && typeof parsed === "object") {
          p.add_phase = parsed;
        }
      } catch {}
    }
  }

  // Handle tasks as string (comma-separated)
  if (p.add_phase && typeof p.add_phase === "object") {
    const ap = p.add_phase as any;
    if (ap.tasks && typeof ap.tasks === "string") {
      try {
        ap.tasks = JSON.parse(ap.tasks);
      } catch {
        ap.tasks = ap.tasks.split(",").map((s: string) => ({ content: s.trim() }));
      }
    }
  }

  return p;
}

// ============================================================================
// Pure Operations - Apply single op, return new state + errors
// ============================================================================

function applyOp(
  phases: TodoPhase[],
  nextTaskId: number,
  nextPhaseId: number,
  params: any
): { phases: TodoPhase[]; nextTaskId: number; nextPhaseId: number; errors: string[] } {
  const errors: string[] = [];
  let resultPhases = clonePhases(phases);
  let tid = nextTaskId;
  let pid = nextPhaseId;

  try {
    if (params.replace) {
      const list = params.replace.phases;
      if (!Array.isArray(list)) { errors.push("replace.phases must be array"); }
      else {
        resultPhases = [];
        for (const input of list) {
          if (!input?.name || typeof input.name !== "string") { errors.push("Invalid phase"); continue; }
          if (input.tasks && !Array.isArray(input.tasks)) { errors.push("tasks must be array"); continue; }
          const { phase, nextTaskId: nt } = buildPhaseFromInput(input, `phase-${pid++}`, tid);
          resultPhases.push(phase);
          tid = nt;
        }
      }
    }
    else if (params.add_phase) {
      const ph = params.add_phase;
      if (!ph?.name || typeof ph.name !== "string") errors.push("add_phase.name required");
      else if (ph.tasks && !Array.isArray(ph.tasks)) errors.push("add_phase.tasks must be array");
      else {
        const phaseId = `phase-${pid++}`;
        const { phase, nextTaskId: nt } = buildPhaseFromInput(ph, phaseId, tid);
        resultPhases.push(phase);
        tid = nt;
      }
    }
    else if (params.add_task) {
      const at = params.add_task;
      if (!at?.phase || typeof at.phase !== "string" || !/^phase-\d+$/.test(at.phase)) errors.push("phase must be like 'phase-1'");
      else if (!at?.content || typeof at.content !== "string") errors.push("content required");
      else {
        const target = resultPhases.find((p: any) => p.id === at.phase);
        if (!target) errors.push(`Phase not found. Available: ${resultPhases.map((p:any)=>p.id).join(', ')}`);
        else {
          target.tasks.push({ id: `task-${tid++}`, content: at.content, status: "pending", notes: at.notes, details: at.details });
        }
      }
    }
    else if (params.update) {
      const up = params.update;
      if (!up?.id || typeof up.id !== "string" || !/^task-\d+$/.test(up.id)) errors.push("task id must be like 'task-1'");
      else {
        const task = findTask(resultPhases, up.id);
        if (!task) errors.push("Task not found");
        else {
          if (up.status !== undefined) task.status = up.status;
          if (up.content !== undefined) task.content = up.content;
          if (up.notes !== undefined) task.notes = up.notes;
          if (up.details !== undefined) task.details = up.details;
        }
      }
    }
    else if (params.remove_task) {
      const rt = params.remove_task;
      if (!rt?.id || typeof rt.id !== "string" || !/^task-\d+$/.test(rt.id)) errors.push("task id must be like 'task-1'");
      else {
        let removed = false;
        for (const phase of resultPhases) {
          const idx = phase.tasks.findIndex((t:any) => t.id === rt.id);
          if (idx !== -1) { phase.tasks.splice(idx, 1); removed = true; break; }
        }
        if (!removed) errors.push("Task not found");
      }
    }
    // list operation: no changes, just return current state
  } catch (e: any) {
    errors.push(e.message || String(e));
  }

  // Normalize invariant
  normalizeInProgress(resultPhases);

  return { phases: resultPhases, nextTaskId: tid, nextPhaseId: pid, errors };
}

function getNextIds(phases: TodoPhase[]): { nextTaskId: number; nextPhaseId: number } {
  let maxTask = 0, maxPhase = 0;
  for (const p of phases) {
    const m = /^phase-(\d+)$/.exec(p.id); if (m && +m[1] > maxPhase) maxPhase = +m[1];
    for (const t of p.tasks) {
      const m = /^task-(\d+)$/.exec(t.id); if (m && +m[1] > maxTask) maxTask = +m[1];
    }
  }
  return { nextTaskId: maxTask + 1, nextPhaseId: maxPhase + 1 };
}

function normalizeInProgress(phases: TodoPhase[]): void {
  const all = phases.flatMap(p => p.tasks);
  if (all.length === 0) return;
  const inProg = all.filter(t => t.status === "in_progress");
  if (inProg.length > 1) for (const t of inProg.slice(1)) t.status = "pending";
  if (inProg.length > 0) return;
  const first = all.find(t => t.status === "pending");
  if (first) first.status = "in_progress";
}

function formatSummary(phases: TodoPhase[], errors: string[]): string {
  const tasks = phases.flatMap(p => p.tasks);
  if (tasks.length === 0) return errors.length ? `Errors: ${errors.join("; ")}` : "Todo list cleared.";

  const remainingByPhase = phases
    .map(phase => ({ name: phase.name, tasks: phase.tasks.filter(t => t.status === "pending" || t.status === "in_progress") }))
    .filter(phase => phase.tasks.length > 0);
  const remaining = remainingByPhase.flatMap(phase => phase.tasks.map(t => ({ ...t, phase: phase.name })));

  const currIdx = phases.findIndex(p => p.tasks.some(t => t.status === "pending" || t.status === "in_progress"));
  const curr = phases[currIdx === -1 ? phases.length - 1 : currIdx];
  const doneCount = curr?.tasks.filter(t => t.status === "completed" || t.status === "abandoned").length ?? 0;

  const lines: string[] = [];
  if (errors.length) {
    lines.push(`⚠️ Errors: ${errors.join("; ")}`);
  } else {
    const pending = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
    const completed = tasks.filter(t => t.status === "completed").length;
    lines.push(`✅ Updated: ${pending} remaining, ${completed} completed.`, "");
  }

  if (remaining.length === 0) {
    lines.push("Remaining: none.");
  } else {
    lines.push(`Remaining (${remaining.length}):`);
    for (const t of remaining) {
      lines.push(`  - ${t.id} ${t.content} [${t.status}] (${t.phase})`);
    }
  }

  lines.push(`Phase ${currIdx + 1}/${phases.length} "${curr?.name ?? "unknown"}" — ${doneCount}/${curr?.tasks.length ?? 0} done`);
  return lines.join("\n");
}

// ============================================================================
// State
// ============================================================================

class TodoState {
  phases: TodoPhase[] = [];
  nextTaskId: number = 1;
  nextPhaseId: number = 1;
  private _lockState = false;
  private listeners: Set<() => void> = new Set();

  get isLocked() { return this._lockState; }
  set _lock(val: boolean) { this._lockState = val; }

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { for (const l of this.listeners) l(); }

  async loadFromFile(): Promise<boolean> {
    if (this._lockState) return false;
    this._lockState = true;
    try {
      const fileData = await loadTodoFromFile();
      if (!fileData) { this.phases = []; this.nextTaskId = 1; this.nextPhaseId = 1; return false; }
      this.phases = clonePhases(fileData.phases);
      this.nextTaskId = fileData.nextTaskId;
      this.nextPhaseId = fileData.nextPhaseId;
      this.notify();
      return true;
    } finally { this._lockState = false; }
  }

  async saveToFile(): Promise<void> {
    if (this._lockState) return;
    const ids = getNextIds(this.phases);
    await saveTodoToFile({ phases: clonePhases(this.phases), nextTaskId: ids.nextTaskId, nextPhaseId: ids.nextPhaseId });
  }

  reconstructFromEntries(entries: any[]): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.type !== "message") continue;
      const m = e.message;
      if (m.role !== "toolResult" || (m.toolName !== "todos" && m.toolName !== "todo_write")) continue;
      const d = m.details as any;
      if (d?.phases) {
        this.phases = clonePhases(d.phases);
        const ids = getNextIds(this.phases);
        this.nextTaskId = ids.nextTaskId;
        this.nextPhaseId = ids.nextPhaseId;
        break;
      }
    }
  }

  addPhase(name: string, tasks?: any[]): TodoPhase {
    const phaseId = `phase-${this.nextPhaseId++}`;
    const { phase, nextTaskId } = buildPhaseFromInput({ name, tasks }, phaseId, this.nextTaskId);
    this.nextTaskId = nextTaskId;
    this.phases.push(phase);
    normalizeInProgress(this.phases);
    this.notify();
    return phase;
  }

  addTask(phaseId: string, content: string, notes?: string, details?: string): TodoItem | null {
    const phase = this.phases.find(p => p.id === phaseId);
    if (!phase) return null;
    phase.tasks.push({ id: `task-${this.nextTaskId++}`, content, status: "pending", notes, details });
    normalizeInProgress(this.phases);
    this.notify();
    return phase.tasks[phase.tasks.length - 1];
  }

  updateTask(taskId: string, updates: Partial<Pick<TodoItem, "status" | "content" | "notes" | "details">>): TodoItem | null {
    const task = findTask(this.phases, taskId);
    if (!task) return null;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.content !== undefined) task.content = updates.content;
    if (updates.notes !== undefined) task.notes = updates.notes;
    if (updates.details !== undefined) task.details = updates.details;
    normalizeInProgress(this.phases);
    this.notify();
    return task;
  }

  removeTask(taskId: string): boolean {
    for (const phase of this.phases) {
      const idx = phase.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        phase.tasks.splice(idx, 1);
        normalizeInProgress(this.phases);
        this.notify();
        return true;
      }
    }
    return false;
  }

  replacePhases(phases: TodoPhase[]): void {
    this.phases = clonePhases(phases);
    normalizeInProgress(this.phases);
    const ids = getNextIds(this.phases);
    this.nextTaskId = ids.nextTaskId;
    this.nextPhaseId = ids.nextPhaseId;
    this.notify();
  }

  getPhases(): TodoPhase[] {
    return clonePhases(this.phases);
  }
}

// ============================================================================
// Render Functions
// ============================================================================

function renderTodosCall(args: any, theme: any): Text {
  const op = args.replace ? "replace" : args.add_phase ? "add_phase" : args.add_task ? "add_task" : args.update ? "update" : args.remove_task ? "remove_task" : args.list ? "list" : "todo";
  const text = `${theme.fg("toolTitle", theme.bold("todos"))} ${theme.fg("muted", op)}`;
  return new Text(text, 0, 0);
}

function renderTodosResult(result: { details?: TodoToolDetails }, options: { expanded: boolean; isPartial: boolean }, theme: any): Text {
  const details = result.details as TodoToolDetails | undefined;
  if (!details) return new Text("", 0, 0);
  if (details.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  if (options.isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);

  const phases = details.phases.filter((p: any) => p.tasks.length > 0);
  const allTasks = phases.flatMap((p: any) => p.tasks);
  if (allTasks.length === 0) return new Text(theme.fg("dim", "No todos"), 0, 0);

  const lines: string[] = [theme.fg("toolTitle", `Todos: ${allTasks.length} tasks`)];
  for (const phase of phases) {
    if (phases.length > 1) lines.push(theme.fg("accent", `▼ ${phase.name}`));
    for (const task of phase.tasks) {
      const color = task.status === "completed" || task.status === "abandoned" ? "dim" : task.status === "in_progress" ? "accent" : "text";
      const prefix = task.status === "in_progress" ? "→" : task.status === "completed" ? "✓" : task.status === "abandoned" ? "✗" : " ";
      lines.push(`${theme.fg(color, `  ${prefix} ${task.id} ${task.content}`)}`);
      if (task.status === "in_progress" && task.details) {
        for (const line of task.details.split("\n")) {
          lines.push(theme.fg("dim", `    ${line}`));
        }
      }
    }
  }

  if (options.expanded) {
    const total = allTasks.length;
    const completed = allTasks.filter((t: any) => t.status === "completed").length;
    const inProgress = allTasks.filter((t: any) => t.status === "in_progress").length;
    const pending = allTasks.filter((t: any) => t.status === "pending").length;
    lines.push("");
    lines.push(theme.fg("muted", `Summary: ${completed} completed, ${inProgress} in progress, ${pending} pending`));
  }

  return new Text(lines.join("\n"), 0, 0);
}

// ============================================================================
// Tool Factory
// ============================================================================

function createTodoTool(api: ExtensionAPI): ToolDefinition<typeof todoWriteSchema, TodoToolDetails> {
  const state = new TodoState();
  let autoTriggering = false;

  api.on("session_start", async (_event, ctx) => {
    await state.loadFromFile();
    state.reconstructFromEntries(ctx.sessionManager.getBranch());
  });

  api.on("session_tree", async (_event, ctx) => {
    state.reconstructFromEntries(ctx.sessionManager.getBranch());
    await state.loadFromFile();
  });

  return {
    name: "todos",
    label: "Todo",
    description: "Simple todo list: add_phase, add_task, update, remove_task, replace, list. Status: pending, in_progress, completed, abandoned. Auto-normalizes exactly ONE in_progress task.",
    promptSnippet: "todos({ add_phase:{ name:'Phase 1', tasks:[{content:'Task 1'}] }, add_task:{ phase:'phase-1', content:'Task 2' }, update:{ id:'task-1', status:'completed' }, replace:{ phases:[{ name:'New Phase', tasks:[{content:'Task'}] }] }, remove_task:{ id:'task-2' }, list:{} })",
    promptGuidelines: [
      "IMPORTANT: All parameters must be OBJECTS, not strings. Do not JSON.stringify any values.",
      "Nested format: { op: { params } } e.g., { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }",
      "Operations:",
      "  - add_phase({ name: string, tasks?: [{ content, status?, notes?, details? }] }) - Create a new phase with optional tasks",
      "  - add_task({ phase: 'phase-1', content: string, notes?, details? }) - Add task to existing phase",
      "  - update({ id: 'task-1', status?, content?, notes?, details? }) - Modify task",
      "  - remove_task({ id: 'task-1' }) - Delete task",
      "  - replace({ phases: [{ name: string, tasks?: [{ content, status?, notes?, details? }] }] }) - Replace entire todo list",
      "  - list({}) - View current todos",
      "Status: pending, in_progress, completed, abandoned (auto-normalize: exactly ONE in_progress task).",
      "After todos: '✅ Updated: X remaining, Y completed'. Suggest next action or continue.",
      "Examples:",
      "  todos({ add_phase: { name: 'Build API', tasks: [{ content: 'Design endpoints' }, { content: 'Auth middleware' }] } })",
      "  todos({ add_task: { phase: 'phase-1', content: 'Implement user login' } })",
      "  todos({ update: { id: 'task-2', status: 'completed', details: 'Login endpoints done' } })",
      "  todos({ remove_task: { id: 'task-3' } })",
      "  todos({ replace: { phases: [{ name: 'Phase 1', tasks: [{ content: 'Task 1' }] }] } })",
      "  todos({ list: {} })",
    ],
    parameters: todoWriteSchema,
    executionMode: "sequential" as const,

    async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
      let p: any;
      try {
        if (typeof params === "string") params = JSON.parse(params);
        if (typeof params !== "object" || params === null) throw new Error("object required");
        p = params;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `❌ Error: ${msg}` }], details: { phases: state.getPhases(), storage: "file", error: msg }, isError: true };
      }

      // Normalize - parse JSON strings
p = normalizeParams(p);

      // Check for multiple operations
      const definedOps: string[] = [];
      if (p.replace) definedOps.push("replace");
      if (p.add_phase) definedOps.push("add_phase");
      if (p.add_task) definedOps.push("add_task");
      if (p.update) definedOps.push("update");
      if (p.remove_task) definedOps.push("remove_task");
      if (p.list) definedOps.push("list");

      const errors: string[] = [];
      if (definedOps.length > 1) {
        errors.push(`Multiple operations: ${definedOps.join(", ")}. Only one per call.`);
      }

      const op = p.replace ? "replace" : p.add_phase ? "add_phase" : p.add_task ? "add_task" : p.update ? "update" : p.remove_task ? "remove_task" : p.list ? "list" : null;
      if (!op) { errors.push("No operation. Use: add_phase, add_task, update, remove_task, list"); }

      // Apply pure operation
      const { phases: newPhases, nextTaskId: newTid, nextPhaseId: newPid, errors: opErrors } = applyOp(
        state.phases,
        state.nextTaskId,
        state.nextPhaseId,
        p
      );
      errors.push(...opErrors);

      // Update state
      state.phases = newPhases;
      state.nextTaskId = newTid;
      state.nextPhaseId = newPid;

      if (errors.length === 0 && op !== "list") {
        try { await state.saveToFile(); } catch (e: any) { errors.push(`Save failed: ${e.message}`); }
      }

      const resultPhases = state.getPhases();
      const summaryText = formatSummary(resultPhases, errors);

      // System message
      if (op && op !== "list" && errors.length === 0) {
        try {
          await api.sendMessage({ customType: "todo_update", content: `[System: Todo ${op}] ${summaryText.split("\n")[0]}`, display: false }, { triggerTurn: false });
        } catch {}
      }

      // Auto-trigger: after successful update, automatically continue
      if (op && op !== "list" && errors.length === 0 && !autoTriggering) {
        autoTriggering = true;
        try {
          await api.sendMessage({
            customType: "todo-auto-continue",
            content: "Continue with the next task. If no tasks remain, validate the work and add new tasks.",
            display: false,
            details: { autoTrigger: true, timestamp: Date.now() }
          }, { triggerTurn: true, deliverAs: "followUp" });

          // Wait for agent to be idle, then continue processing
          const agent = (ctx as any)?.agent || (ctx as any)?.session?.agent;
          if (agent && typeof agent.waitForIdle === 'function') {
            await agent.waitForIdle();
            await agent.continue();
          }
        } catch (e) {
          console.error("Auto-continue failed:", e);
        } finally {
          setTimeout(() => { autoTriggering = false; }, 500);
        }
      }

      return { content: [{ type: "text", text: summaryText }], details: { phases: resultPhases, storage: "file", error: errors.length ? errors.join("; ") : undefined }, isError: errors.length > 0 };
    },

    renderCall: renderTodosCall,
    renderResult: renderTodosResult,
  };
}

// ============================================================================
// Export
// ============================================================================

export function registerTodosTool(api: ExtensionAPI): void {
  api.registerTool(createTodoTool(api));
}
