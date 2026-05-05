/**
 * Command History Patch
 *
 * Patches Editor and InteractiveMode to add persistent command history.
 * This module should be imported before any InteractiveMode is instantiated.
 */

import { Editor } from "@mariozechner/pi-tui";
import { InteractiveMode } from "@mariozechner/pi-coding-agent";
import { CommandHistoryService } from "./services/command-history.js";

const historyService = CommandHistoryService.getInstance();

// ============================================================================
// Patch 1: Load history into editor after InteractiveMode.init()
// ============================================================================

const originalInit = (InteractiveMode.prototype as any).init;
if (originalInit) {
	(InteractiveMode.prototype as any).init = async function (...args: any[]) {
		// Call original init first (creates editor)
		await originalInit.apply(this, args);

		// Access defaultEditor (private at TS level, but runtime property)
		const editor = this.defaultEditor;
		if (editor) {
			const savedHistory = historyService.load();
			// @ts-ignore: history is private in Editor class
			editor.history = savedHistory;
			// @ts-ignore: historyIndex is private
			editor.historyIndex = -1;
		}
	};
}

// ============================================================================
// Patch 2: Auto-save history when addToHistory() is called
// ============================================================================

const originalAddToHistory = (Editor.prototype as any).addToHistory;
if (originalAddToHistory) {
	// Debounce map to avoid excessive writes
	const saveTimeouts = new WeakMap<Editor, any>();

	(Editor.prototype as any).addToHistory = function (text: string) {
		const result = originalAddToHistory.call(this, text);

		// Debounce save by 100ms to batch rapid additions
		let timeout = saveTimeouts.get(this);
		if (timeout) clearTimeout(timeout);

		timeout = setTimeout(() => {
			historyService.save(this.history);
		}, 100);

		saveTimeouts.set(this, timeout);

		return result;
	};
}
