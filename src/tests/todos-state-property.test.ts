#!/usr/bin/env node
/**
 * Property-based tests for Todos state consistency.
 * Generates random sequences of operations and verifies invariants.
 */

import { test, expect, describe, beforeEach } from "vitest";
import { TodoState } from "../extensions/tools/todos-tool.js";

function randomWord(min = 3, max = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const len = Math.floor(Math.random() * (max - min + 1)) + min;
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function assertValidPhases(phases: any[]): void {
  const allTaskIds = new Set<string>();
  for (const phase of phases) {
    expect(phase.id).toMatch(/^phase-\d+$/);
    expect(phase.name).toBeTruthy();
    for (const task of phase.tasks) {
      expect(task.id).toMatch(/^task-\d+$/);
      expect(task.content).toBeTruthy();
      expect(["pending", "in_progress", "completed", "abandoned"]).toContain(task.status);
      expect(allTaskIds.has(task.id)).toBe(false);
      allTaskIds.add(task.id);
    }
  }
}

describe("Todos State Property Tests", () => {
  let state: TodoState;

  beforeEach(() => {
    state = new TodoState();
  });

  test("random add_phase and add_task sequences maintain consistency", async () => {
    for (let i = 0; i < 50; i++) {
      const choice = Math.random();
      if (choice < 0.3 || state.getPhases().length === 0) {
        await state.addPhase({ name: randomWord() });
      } else {
        const phases = state.getPhases();
        const phase = phases[Math.floor(Math.random() * phases.length)];
        await state.addTask(phase.id, { content: randomWord() });
      }
      // Invariants
      assertValidPhases(state.getPhases());
    }
    const totalTasks = state.getPhases().reduce((sum: number, p: any) => sum + p.tasks.length, 0);
    expect(totalTasks).toBeGreaterThan(0);
  });

  test("update and remove operations maintain valid state", async () => {
    // Setup
    await state.addPhase({ name: "P1" });
    await state.addPhase({ name: "P2" });
    let phases = state.getPhases();
    await state.addTask(phases[0].id, { content: "T1" });
    await state.addTask(phases[0].id, { content: "T2" });
    await state.addTask(phases[1].id, { content: "T3" });

    assertValidPhases(state.getPhases());

    for (let i = 0; i < 30; i++) {
      const phases = state.getPhases();
      // Collect all tasks
      const allTasks: any[] = [];
      for (const p of phases) allTasks.push(...p.tasks);
      const task = allTasks[Math.floor(Math.random() * allTasks.length)];
      const newStatus = ["pending", "in_progress", "completed", "abandoned"][Math.floor(Math.random() * 4)] as any;
      await state.updateTask(task.id, { status: newStatus });

      if (Math.random() < 0.2 && allTasks.length > 1) {
        await state.removeTask(task.id);
      }

      assertValidPhases(state.getPhases());
    }
  });

  test("can reach large number of tasks with mixed operations", async () => {
    for (let i = 0; i < 100; i++) {
      if (state.getPhases().length === 0 || Math.random() < 0.4) {
        await state.addPhase({ name: `Phase ${randomWord(1,3)}` });
      } else {
        const phases = state.getPhases();
        const phase = phases[Math.floor(Math.random() * phases.length)];
        await state.addTask(phase.id, { content: `Task ${randomWord(1,5)}` });
      }
    }
    const finalPhases = state.getPhases();
    expect(finalPhases.length).toBeGreaterThan(0);
    const totalTasks = finalPhases.reduce((sum: number, p: any) => sum + p.tasks.length, 0);
    expect(totalTasks).toBeGreaterThan(50);
    assertValidPhases(finalPhases);
  });
});
