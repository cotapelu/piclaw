#!/usr/bin/env node

/**
 * Prompt utilities for interactive CLI
 */

/**
 * Prompt for yes/no confirmation
 */
export async function promptConfirm(message: string): Promise<boolean> {
  const readline = require("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Prompt with default value
 */
export async function promptWithDefault(question: string, defaultValue: string): Promise<string> {
  const readline = require("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Prompt for selection from array
 */
export async function promptSelect(
  options: string[],
  prompt: string = "Select an option"
): Promise<string | undefined> {
  const readline = require("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    for (let i = 0; i < options.length; i++) {
      console.log(`  ${i + 1}. ${options[i]}`);
    }
    console.log("");

    rl.question(`${prompt} (1-${options.length}), or press Enter to cancel: `, (answer: string) => {
      rl.close();
      if (!answer.trim()) {
        resolve(undefined);
        return;
      }
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx]);
      } else {
        resolve(undefined);
      }
    });
  });
}
