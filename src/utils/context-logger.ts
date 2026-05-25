#!/usr/bin/env node

/**
 * Context Logger
 *
 * Utility to log the full LLM context (system prompt, messages, tools) before
 * it is sent to the provider. Useful for debugging, inspection, and understanding
 * what exactly gets sent to the LLM.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Message } from "@earendil-works/pi-ai";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * Configuration for context logging.
 */
export interface ContextLoggerOptions {
	/** Path to log file. If undefined, logging is disabled. */
	logFile?: string;
	/** Whether to append to existing file or overwrite. Default: append. */
	append?: boolean;
	/** Maximum number of messages to log (for truncation). Default: unlimited. */
	maxMessages?: number;
	/** Whether to include tool definitions in the log. Default: true. */
	includeTools?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<ContextLoggerOptions, "logFile">> = {
	append: true,
	maxMessages: Infinity,
	includeTools: true,
};

/**
 * Format a single AgentMessage for logging.
 */
function formatAgentMessage(msg: Message, index: number): string {
	const timestamp = "timestamp" in msg && msg.timestamp ? new Date(msg.timestamp).toISOString() : "";
	let contentStr = "";

	if (Array.isArray(msg.content)) {
		contentStr = msg.content
			.map((c) => {
				if (c.type === "text") {
					return (c as any).text;
				}
				if (c.type === "image") {
					return `[IMAGE: ${(c as any).source.type}]`;
				}
				return `[${c.type}]`;
			})
			.join("\n");
	} else {
		contentStr = String(msg.content);
	}

	const roleLabel = msg.role === "user" ? "USER" : msg.role === "assistant" ? "ASSISTANT" : "TOOL_RESULT";

	return `--- Message ${index} (${roleLabel}, ${timestamp}) ---\n${contentStr}\n`;
}

/**
 * Format the full context for logging.
 */
export function formatContext(
	context: {
		systemPrompt: string;
		messages: Message[];
		tools?: Array<{ name: string; description: string; parameters?: any }>;
	},
	options: ContextLoggerOptions = {},
): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	let output = "=== LLM CONTEXT LOG ===\n\n";

	// System prompt
	if (context.systemPrompt) {
		output += `--- SYSTEM PROMPT ---\n${context.systemPrompt}\n\n`;
	}

	// Messages (with limit)
	const messagesToLog = context.messages.slice(0, opts.maxMessages);
	output += `--- CONVERSATION (${messagesToLog.length} messages) ---\n`;
	for (let i = 0; i < messagesToLog.length; i++) {
		output += `${formatAgentMessage(messagesToLog[i], i)  }\n`;
	}

	// Tools
	if (opts.includeTools && context.tools && context.tools.length > 0) {
		output += `--- AVAILABLE TOOLS (${context.tools.length}) ---\n`;
		for (const tool of context.tools) {
			output += `• ${tool.name}: ${tool.description}\n`;
			if (tool.parameters) {
				output += `  Parameters: ${JSON.stringify(tool.parameters, null, 2)}\n`;
			}
		}
		output += "\n";
	}

	output += `=== END CONTEXT LOG (${new Date().toISOString()}) ===\n`;
	return output;
}

/**
 * Write context log to file.
 */
export function writeContextLog(context: {
	systemPrompt: string;
	messages: Message[];
	tools?: Array<{ name: string; description: string; parameters?: any }>;
}, options: ContextLoggerOptions = {}): void {
	const logFile = options.logFile;
	if (!logFile) {
		return; // Logging disabled
	}

	try {
		const logDir = dirname(logFile);
		if (!existsSync(logDir)) {
			mkdirSync(logDir, { recursive: true });
		}

		const formatted = formatContext(context, options);

		if (options.append) {
			appendFileSync(logFile, formatted);
		} else {
			writeFileSync(logFile, formatted);
		}
	} catch (error) {
		// Don't throw - logging should never break the main flow
		console.error("ContextLogger: Failed to write log file:", error);
	}
}

/**
 * Create a wrapper stream function that logs context before sending to LLM.
 *
 * Usage:
 * ```typescript
 * const loggedStreamFn = createContextLoggingStreamFn(originalStreamFn, contextLogFile);
 * ```
 */
export function createContextLoggingStreamFn(
	originalStreamFn: (...args: any[]) => any,
	logFile: string,
	logOptions?: Omit<ContextLoggerOptions, "logFile">,
): (...args: any[]) => any {
	return async (...args: any[]) => {
		const [model, context, options] = args;
		// Log the context before sending
		writeContextLog(
			{
				systemPrompt: context.systemPrompt,
				messages: context.messages,
				tools: context.tools,
			},
			{ logFile, ...logOptions },
		);

		// Call original stream function
		return originalStreamFn(...args);
	};
}
