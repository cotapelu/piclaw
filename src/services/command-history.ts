import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const HISTORY_FILENAME = 'history.json';
const MAX_ENTRIES = 100;

/**
 * Service for managing persistent command history across sessions.
 * Stores history in ~/.piclaw/history.json
 */
export class CommandHistoryService {
	private static instance: CommandHistoryService | null = null;

	/** Get singleton instance */
	static getInstance(): CommandHistoryService {
		if (!CommandHistoryService.instance) {
			CommandHistoryService.instance = new CommandHistoryService();
		}
		return CommandHistoryService.instance;
	}

	private constructor() {}

	/** Get path to history file */
	private getHistoryPath(): string {
		const homedir = os.homedir();
		return path.join(homedir, '.piclaw', HISTORY_FILENAME);
	}

	/** Load history from file */
	load(): string[] {
		try {
			const historyPath = this.getHistoryPath();
			if (!fs.existsSync(historyPath)) {
				return [];
			}
			const content = fs.readFileSync(historyPath, 'utf-8');
			const data = JSON.parse(content);
			if (Array.isArray(data)) {
				// Limit to MAX_ENTRIES
				return data.slice(0, MAX_ENTRIES);
			}
		} catch (error) {
			// Ignore errors, return empty array
		}
		return [];
	}

	/** Save history to file */
	save(history: string[]): void {
		try {
			const historyPath = this.getHistoryPath();
			const dir = path.dirname(historyPath);

			// Ensure directory exists
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			// Deduplicate consecutive entries while preserving order (newest first)
			const deduped: string[] = [];
			for (const item of history) {
				if (deduped.length === 0 || deduped[0] !== item) {
					deduped.unshift(item);
				}
			}

			// Limit size
			const toSave = deduped.slice(0, MAX_ENTRIES);

			// Atomic write: write to temp then rename
			const tmpPath = historyPath + '.tmp';
			fs.writeFileSync(tmpPath, JSON.stringify(toSave, null, 2), 'utf-8');
			fs.renameSync(tmpPath, historyPath);
		} catch (error) {
			// Ignore save errors to not disrupt UX
		}
	}
}
