/**
 * SFTP (SSH File Transfer Protocol) sub-tool for secure file transfers
 */

export const sftpSchema = {
	name: "sftp",
	description: "Transfer files securely over SSH using SFTP protocol",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full sftp command to execute"
			},
			host: {
				type: "string",
				description: "Remote SFTP server hostname or IP"
			},
			port: {
				type: "number",
				description: "SSH port (default: 22)"
			},
			user: {
				type: "string",
				description: "Username for authentication"
			},
			password: {
				type: "string",
				description: "Password for authentication (or use key-based auth)"
			},
			key: {
				type: "string",
				description: "Path to private key file for authentication"
			},
			download: {
				type: "string",
				description: "Download file from remote (format: 'remote-path local-path')"
			},
			upload: {
				type: "string",
				description: "Upload file to remote (format: 'local-path remote-path')"
			},
			list: {
				type: "string",
				description: "List files on remote directory"
			},
			mkdir: {
				type: "string",
				description: "Create remote directory"
			},
			rmdir: {
				type: "string",
				description: "Remove remote directory"
			},
			rm: {
				type: "string",
				description: "Remove remote file"
			},
			rename: {
				type: "string",
				description: "Rename remote file (format: 'old-name new-name')"
			},
			chmod: {
				type: "string",
				description: "Change remote file permissions (format: 'mode path')"
			},
			version: {
				type: "boolean",
				description: "Show sftp version"
			}
		},
		required: ["command"]
	}
};

export async function executeSftp(args: { command?: string; host?: string; port?: number; user?: string; password?: string; key?: string; download?: string; upload?: string; list?: string; mkdir?: string; rmdir?: string; rm?: string; rename?: string; chmod?: string; version?: boolean }): Promise<string> {
	const { command, host, port, user, password, key, download, upload, list, mkdir, rmdir, rm, rename, chmod, version } = args;
	
	let cmd = "sftp";
	
	if (version) {
		cmd = "sftp -V";
	} else if (command) {
		cmd = command;
	} else if (host) {
		// Build connection string
		let connection = "";
		if (user) {
			connection = `${user}@${host}`;
		} else {
			connection = host;
		}
		if (port && port !== 22) {
			cmd = `sftp -P ${port} ${connection}`;
		} else {
			cmd = `sftp ${connection}`;
		}
		
		// Add key if provided
		if (key) {
			cmd += ` -i ${key}`;
		}
		
		// Add operations
		if (download) {
			const parts = download.split(' ');
			if (parts.length >= 2) {
				cmd += ` get ${parts[0]} ${parts[1]}`;
			} else {
				return "Error: Download format should be 'remote-path local-path'";
			}
		} else if (upload) {
			const parts = upload.split(' ');
			if (parts.length >= 2) {
				cmd += ` put ${parts[0]} ${parts[1]}`;
			} else {
				return "Error: Upload format should be 'local-path remote-path'";
			}
		} else if (list) {
			cmd += ` ls ${list}`;
		} else if (mkdir) {
			cmd += ` mkdir ${mkdir}`;
		} else if (rmdir) {
			cmd += ` rmdir ${rmdir}`;
		} else if (rm) {
			cmd += ` rm ${rm}`;
		} else if (rename) {
			const parts = rename.split(' ');
			if (parts.length >= 2) {
				cmd += ` rename ${parts[0]} ${parts[1]}`;
			} else {
				return "Error: Rename format should be 'old-name new-name'";
			}
		} else if (chmod) {
			const parts = chmod.split(' ');
			if (parts.length >= 2) {
				cmd += ` chmod ${parts[0]} ${parts[1]}`;
			} else {
				return "Error: Chmod format should be 'mode path'";
			}
		}
	} else {
		return "Error: Please provide host with operations (download, upload, list, mkdir, etc.) or a full command. Use --version to see sftp version.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	// If using password, we'd need expect or sshpass - not directly supported
	// We'll rely on key-based auth or interactive mode
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}