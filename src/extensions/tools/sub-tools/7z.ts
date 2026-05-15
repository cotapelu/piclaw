/**
 * 7z sub-tool for 7-Zip archive operations
 */

export const sevenZipSchema = {
	name: "7z",
	description: "Create and extract 7z archives using 7z command",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full 7z command to execute"
			},
			files: {
				type: "string",
				description: "Files or directories to archive (space separated)"
			},
			archive: {
				type: "string",
				description: "Archive file name"
			},
			extract: {
				type: "string",
				description: "Archive file to extract"
			},
			output_dir: {
				type: "string",
				description: "Output directory for extraction"
			},
			format: {
				type: "string",
				description: "Archive format: 7z, zip, gzip, bzip2, tar, xz"
			},
			level: {
				type: "number",
				description: "Compression level (0-9)"
			},
			password: {
				type: "string",
				description: "Password for encrypted archive"
			},
			list: {
				type: "boolean",
				description: "List archive contents"
			},
			test: {
				type: "boolean",
				description: "Test archive integrity"
			},
			verbose: {
				type: "boolean",
				description: "Verbose output"
			},
			version: {
				type: "boolean",
				description: "Show version"
			}
		},
		required: ["command"]
	}
};

export async function execute7z(args: { command?: string; files?: string; archive?: string; extract?: string; output_dir?: string; format?: string; level?: number; password?: string; list?: boolean; test?: boolean; verbose?: boolean; version?: boolean }): Promise<string> {
	const { command, files, archive, extract, output_dir, format, level, password, list, test, verbose, version } = args;
	
	let cmd = "";
	
	if (version) {
		cmd = "7z --help 2>&1 | head -5";
	} else if (command) {
		cmd = command;
	} else if (extract || list || test) {
		// Extract, list or test mode
		cmd = "7z";
		
		if (list) cmd += " l";
		else if (test) cmd += " t";
		else cmd += " x";
		
		if (output_dir) cmd += ` -o${output_dir}`;
		if (password) cmd += ` -p${password}`;
		if (verbose) cmd += " -y";
		
		cmd += ` '${extract || archive || 'archive.7z'}'`;
	} else if (archive || files) {
		// Create mode
		cmd = "7z a";
		
		const archiveName = archive || "archive.7z";
		if (format) cmd += ` -t${format}`;
		if (level) cmd += ` -mx=${level}`;
		if (password) cmd += ` -p${password}`;
		if (verbose) cmd += " -y";
		
		cmd += ` ${archiveName}`;
		cmd += ` ${files || "."}`;
	} else {
		return "Error: Please provide files to archive or archive to extract. Use --version to see 7z version.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 180000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}