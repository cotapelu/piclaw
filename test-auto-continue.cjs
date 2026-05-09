#!/usr/bin/env node
/**
 * Test script for auto-continue.ts logic
 * Kiểm tra: findProjectRoot() và loadReminderMessage()
 */

const path = require("node:path");
const fs = require("node:fs");

// Constants from extension
const REMINDER_FILE = "AUTO-CONTINUE.md";
const DEFAULT_IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";

// Function from extension
function findProjectRoot(startPath) {
  let current = startPath;
  const root = path.parse(current).root;

  while (current && current !== root) {
    if (
      fs.existsSync(path.join(current, "package.json")) ||
      fs.existsSync(path.join(current, ".git")) ||
      fs.existsSync(path.join(current, "pi.config.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startPath;
}

// Function from extension
function loadReminderMessage() {
  try {
    const projectRoot = findProjectRoot(process.cwd());
    const filePath = path.join(projectRoot, REMINDER_FILE);
    console.log(`[Test] CWD: ${process.cwd()}`);
    console.log(`[Test] Project root: ${projectRoot}`);
    console.log(`[Test] Looking for: ${filePath}`);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const trimmed = content.trim();
      if (trimmed) {
        console.log(`[Test] ✅ File found! Content (first 50 chars): "${trimmed.substring(0, 50)}..."`);
        return trimmed;
      } else {
        console.log(`[Test] ⚠️ File exists but empty/whitespace`);
      }
    } else {
      console.log(`[Test] ❌ File NOT found at that path`);
    }
  } catch (error) {
    console.error("[Test] Error:", error);
  }
  console.log(`[Test] Using default message`);
  return DEFAULT_IDLE_MESSAGE;
}

// ===== TEST CASES =====

console.log("=".repeat(60));
console.log("TEST 1: Run from project root (/home/quangtynu/Qcoder/qclaw)");
console.log("=".repeat(60));
process.chdir("/home/quangtynu/Qcoder/qclaw");
const msg1 = loadReminderMessage();
console.log("Result message:", msg1.substring(0, 80), "...\n");

console.log("=".repeat(60));
console.log("TEST 2: Run from subfolder (/home/quangtynu/Qcoder/qclaw/src)");
console.log("=".repeat(60));
process.chdir("/home/quangtynu/Qcoder/qclaw/src");
const msg2 = loadReminderMessage();
console.log("Result message:", msg2.substring(0, 80), "...\n");

console.log("=".repeat(60));
console.log("TEST 3: Run from deep subfolder (hooks)");
console.log("=".repeat(60));
process.chdir("/home/quangtynu/Qcoder/qclaw/src/extensions/hooks");
const msg3 = loadReminderMessage();
console.log("Result message:", msg3.substring(0, 80), "...\n");

console.log("=".repeat(60));
console.log("TEST 4: Run from NON-project folder (/tmp)");
console.log("=".repeat(60));
process.chdir("/tmp");
const msg4 = loadReminderMessage();
console.log("Result message:", msg4.substring(0, 80), "...\n");

console.log("=".repeat(60));
console.log("SUMMARY");
console.log("=".repeat(60));
console.log("Test 1 (project root):", msg1 === DEFAULT_IDLE_MESSAGE ? "❌ USING DEFAULT" : "✅ USING FILE");
console.log("Test 2 (src subfolder):", msg2 === DEFAULT_IDLE_MESSAGE ? "❌ USING DEFAULT" : "✅ USING FILE");
console.log("Test 3 (deep subfolder):", msg3 === DEFAULT_IDLE_MESSAGE ? "❌ USING DEFAULT" : "✅ USING FILE");
console.log("Test 4 (non-project):", msg4 === DEFAULT_IDLE_MESSAGE ? "❌ USING DEFAULT (expected)" : "✅ USING FILE (unexpected)");
