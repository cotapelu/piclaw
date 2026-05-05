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

const StatusEnum = Type.Union([Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed"), Type.Literal("abandoned")]);

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

const ReplaceOp = Type.Object({ phases: Type.Array(InputPhase) });
const AddPhaseOp = Type.Object({ name: Type.String(), tasks: Type.Optional(Type.Array(InputTask)) });
const AddTaskOp = Type.Object({ phase: Type.String(), content: Type.String(), notes: Type.Optional(Type.String()), details: Type.Optional(Type.String()) });
const UpdateOp = Type.Object({ id: Type.String(), status: Type.Optional(StatusEnum), content: Type.Optional(Type.String()), notes: Type.Optional(Type.String()), details: Type.Optional(Type.String()) });
const RemoveTaskOp = Type.Object({ id: Type.String() });
const ListOp = Type.Object({});

const todoWriteSchema = Type.Object({
  replace: Type.Optional(ReplaceOp),
  add_phase: Type.Optional(AddPhaseOp),
  add_task: Type.Optional(AddTaskOp),
  update: Type.Optional(UpdateOp),
  remove_task: Type.Optional(RemoveTaskOp),
  list: Type.Optional(ListOp),
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

function summary(phases: TodoPhase[], errors: string[]): string {
  const tasks = phases.flatMap(p => p.tasks);
  if (tasks.length === 0) return errors.length ? `Errors: ${errors.join("; ")}` : "Todo list cleared.";
  const remaining = phases.map(p => ({ name: p.name, tasks: p.tasks.filter(t => t.status === "pending" || t.status === "in_progress") })).filter(p => p.tasks.length).flatMap(p => p.tasks.map(t => ({ ...t, phase: p.name })));
  const currIdx = phases.findIndex(p => p.tasks.some(t => t.status === "pending" || t.status === "in_progress"));
  const curr = phases[currIdx === -1 ? phases.length - 1 : currIdx];
  const lines: string[] = [];
  if (errors.length) lines.push(`⚠️ Errors: ${errors.join("; ")}`);
  else { const p = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length; const c = tasks.filter(t => t.status === "completed").length; lines.push(`✅ Updated: ${p} remaining, ${c} completed.`, ""); }
  lines.push(remaining.length === 0 ? "Remaining: none." : `Remaining (${remaining.length}):` + remaining.map(t => `  - ${t.id} ${t.content} [${t.status}] (${t.phase})`).join("\n"));
  lines.push(`Phase ${currIdx + 1}/${phases.length} "${curr?.name ?? "unknown"}" — ${curr?.tasks.filter(t => t.status === "completed").length ?? 0}/${curr?.tasks.length ?? 0} done`);
  return lines.join("\n");
}

// ============================================================================
// State
// ============================================================================

class TodoState {
  private _phases: TodoPhase[] = [];
  private _nextTaskId = 1;
  private _nextPhaseId = 1;
  private _lockState = false;
  private listeners: Set<() => void> = new Set();

  get phases() { return this._phases; }
  get nextTaskId() { return this._nextTaskId; }
  set nextTaskId(val: number) { this._nextTaskId = val; }
  get nextPhaseId() { return this._nextPhaseId; }
  set nextPhaseId(val: number) { this._nextPhaseId = val; }
  get isLocked() { return this._lockState; }
  set _lock(val: boolean) { this._lockState = val; }

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { for (const l of this.listeners) l(); }

  async loadFromFile(): Promise<boolean> {
    if (this._lockState) return false;
    this._lockState = true;
    try {
      const fileData = await loadTodoFromFile();
      if (!fileData) { this._phases = []; this._nextTaskId = 1; this._nextPhaseId = 1; return false; }
      this._phases = clonePhases(fileData.phases);
      this._nextTaskId = fileData.nextTaskId;
      this._nextPhaseId = fileData.nextPhaseId;
      this.notify();
      return true;
    } finally { this._lockState = false; }
  }

  async saveToFile(): Promise<void> {
    if (this._lockState) return;
    const ids = getNextIds(this._phases);
    await saveTodoToFile({ phases: clonePhases(this._phases), nextTaskId: ids.nextTaskId, nextPhaseId: ids.nextPhaseId });
  }

  reconstructFromEntries(entries: any[]): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.type !== "message") continue;
      const m = e.message;
      if (m.role !== "toolResult" || (m.toolName !== "todos" && m.toolName !== "todo_write")) continue;
      const d = m.details as any;
      if (d?.phases) {
        this._phases = clonePhases(d.phases);
        const ids = getNextIds(this._phases);
        this._nextTaskId = ids.nextTaskId;
        this._nextPhaseId = ids.nextPhaseId;
        break;
      }
    }
  }

  addPhase(name: string, tasks?: any[]): TodoPhase {
    const phaseId = `phase-${this._nextPhaseId++}`;
    const { phase, nextTaskId } = buildPhaseFromInput({ name, tasks }, phaseId, this._nextTaskId);
    this._nextTaskId = nextTaskId;
    this._phases.push(phase);
    normalizeInProgress(this._phases);
    this.notify();
    return phase;
  }

  addTask(phaseId: string, content: string, notes?: string, details?: string): TodoItem | null {
    const phase = this._phases.find(p => p.id === phaseId);
    if (!phase) return null;
    phase.tasks.push({ id: `task-${this._nextTaskId++}`, content, status: "pending", notes, details });
    normalizeInProgress(this._phases);
    this.notify();
    return phase.tasks[phase.tasks.length - 1];
  }

  updateTask(taskId: string, updates: Partial<Pick<TodoItem, "status" | "content" | "notes" | "details">>): TodoItem | null {
    const task = findTask(this._phases, taskId);
    if (!task) return null;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.content !== undefined) task.content = updates.content;
    if (updates.notes !== undefined) task.notes = updates.notes;
    if (updates.details !== undefined) task.details = updates.details;
    normalizeInProgress(this._phases);
    this.notify();
    return task;
  }

  removeTask(taskId: string): boolean {
    for (const phase of this._phases) {
      const idx = phase.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        phase.tasks.splice(idx, 1);
        normalizeInProgress(this._phases);
        this.notify();
        return true;
      }
    }
    return false;
  }

  replacePhases(phases: TodoPhase[]): void {
    this._phases = clonePhases(phases);
    normalizeInProgress(this._phases);
    const ids = getNextIds(this._phases);
    this._nextTaskId = ids.nextTaskId;
    this._nextPhaseId = ids.nextPhaseId;
    this.notify();
  }

  getPhases(): TodoPhase[] {
    return clonePhases(this._phases);
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
  let pendingAutoContinue = false;

  // Auto-continue trigger on turn_end when LLM idle
  api.on("turn_end", async (_event, ctx) => {
    if (pendingAutoContinue && ctx.isIdle()) {
      pendingAutoContinue = false;
      try {
        await api.sendMessage({
          customType: "todo-auto-continue",
          content: "Continue with next task.",
          display: false
        }, { triggerTurn: true });
      } catch (e) {
        console.error("Auto-continue failed:", e);
      }
    }
  });

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
    description: "Simple todo list: add_phase, add_task, update, remove_task, list. Auto-normalizes one in_progress task.",
    promptSnippet: "todos({ add_phase:{ name:'Phase', tasks:[{content:'Task'}] }, add_task:{ phase:'phase-1', content:'Task' }, update:{ id:'task-1', status:'completed' }, remove_task:{ id:'task-2' }, list:{} })",
    promptGuidelines: [
      "NESTED FORMAT: { op: { params } } e.g., { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }",
      "OPERATIONS:",
      "  add_phase({ name: string, tasks?: [{ content, status?, notes?, details? }] })",
      "  add_task({ phase: 'phase-1', content: string, notes?, details? })",
      "  update({ id: 'task-1', status?, content?, notes?, details? })",
      "  remove_task({ id: 'task-1' })",
      "  list({})",
      "STATUS: pending, in_progress, completed, abandoned (auto 1 in_progress).",
      "All parameters are OBJECTS. Do not JSON.stringify.",
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

      // Normalize stringified objects
      if (p.add_phase && typeof p.add_phase === "string") {
        try { p.add_phase = JSON.parse(p.add_phase); } catch (e) { p.add_phase = null; }
      }
      if (p.replace?.phases && typeof p.replace.phases === "string") {
        try { p.replace.phases = JSON.parse(p.replace.phases); } catch (e) { p.replace = null; }
      }

      const errors: string[] = [];
      const op = p.replace ? "replace" : p.add_phase ? "add_phase" : p.add_task ? "add_task" : p.update ? "update" : p.remove_task ? "remove_task" : p.list ? "list" : null;
      if (!op) { errors.push("No operation. Use: add_phase, add_task, update, remove_task, list"); }

      try {
        if (op === "replace") {
          const list = p.replace?.phases;
          if (!Array.isArray(list)) errors.push("replace.phases must be array");
          else {
            const newPs: TodoPhase[] = [];
            let tid = state.nextTaskId, pid = state.nextPhaseId;
            for (const input of list) {
              if (!input?.name || typeof input.name !== "string") { errors.push(`Invalid phase`); continue; }
              if (input.tasks && !Array.isArray(input.tasks)) { errors.push(`tasks must be array`); continue; }
              const { phase, nextTaskId: nt } = buildPhaseFromInput(input, `phase-${pid++}`, tid);
              newPs.push(phase); tid = nt;
            }
            state.replacePhases(newPs);
            state.nextTaskId = tid; state.nextPhaseId = pid;
          }
        }
        else if (op === "add_phase") {
          const ph = p.add_phase;
          if (!ph?.name || typeof ph.name !== "string") errors.push("add_phase.name required");
          else if (ph.tasks && !Array.isArray(ph.tasks)) errors.push("add_phase.tasks must be array");
          else {
            state.addPhase(ph.name, ph.tasks);
          }
        }
        else if (op === "add_task") {
          const at = p.add_task;
          if (!at?.phase || typeof at.phase !== "string" || !/^phase-\d+$/.test(at.phase)) errors.push("phase must be like 'phase-1'");
          else if (!at?.content || typeof at.content !== "string") errors.push("content required");
          else {
            const task = state.addTask(at.phase, at.content, at.notes, at.details);
            if (!task) errors.push(`Phase not found. Available phases: ${state.phases.map(p=>p.id).join(', ')}`);
          }
        }
        else if (op === "update") {
          const up = p.update;
          if (!up?.id || typeof up.id !== "string" || !/^task-\d+$/.test(up.id)) errors.push("task id must be like 'task-1'");
          else {
            const task = state.updateTask(up.id, up);
            if (!task) errors.push(`Task not found`);
          }
        }
        else if (op === "remove_task") {
          const rt = p.remove_task;
          if (!rt?.id || typeof rt.id !== "string" || !/^task-\d+$/.test(rt.id)) errors.push("task id must be like 'task-1'");
          else {
            const removed = state.removeTask(rt.id);
            if (!removed) errors.push(`Task not found`);
          }
        }
      } catch (e: any) {
        errors.push(e.message || String(e));
      }

      if (errors.length === 0 && op !== "list") {
        try { await state.saveToFile(); } catch (e: any) { errors.push(`Save failed: ${e.message}`); }
      }

      const resultPhases = state.getPhases();
      const summaryText = summary(resultPhases, errors);

      // System message
      if (op && op !== "list" && errors.length === 0) {
        try {
          await api.sendMessage({ customType: "todo_update", content: `[System: Todo ${op}] ${summaryText.split("\n")[0]}`, display: false }, { triggerTurn: false });
        } catch {}
      }

      // Auto-continue: set flag, actual trigger handled by turn_end event
      if (op && op !== "list" && errors.length === 0) {
        pendingAutoContinue = true;
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
