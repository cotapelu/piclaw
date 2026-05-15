/**
 * SMB Client (smbclient) sub-tool for accessing SMB/CIFS shares
 */

export const smbclientSchema = {
	name: "smbclient",
	description: "Access SMB/CIFS shares using smbclient",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full smbclient command to execute"
			},
			share: {
				type: "string",
				description: "SMB share URL (e.g., '//server/share')"
			},
			user: {
				type: "string",
				description: "Username for authentication"
			},
			password: {
				type: "string",
				description: "Password for authentication"
			},
			list: {
				type: "string",
				description: "List shares on server (provide server name)"
			},
			download: {
				type: "string",
				description: "Download file from share (format: 'remote-path local-path')"
			},
			upload: {
				type: "string",
				description: "Upload file to share (format: 'local-path remote-path')"
			},
			list_files: {
				type: "boolean",
				description: "List files in current share"
			},
			mkdir: {
				type: "string",
				description: "Create directory on share"
			},
			rmdir: {
				type: "string",
				description: "Remove directory from share"
			},
			rm: {
				type: "string",
				description: "Remove file from share"
			},
			pwd: {
				type: "boolean",
				description: "Print current working directory on share"
			},
			cd: {
				type: "string",
				description: "Change directory on share"
			},
			version: {
				type: "boolean",
				description: "Show smbclient version"
			}
		},
		required: ["command"]
	}
};

export async function executeSmbclient(args: { command?: string; share?: string; user?: string; password?: string; list?: string; download?: string; upload?: string; list_files?: boolean; mkdir?: string; rmdir?: string; rm?: string; pwd?: boolean; cd?: string; version?: boolean }): Promise<string> {
	const { command, share, user, password, list, download, upload, list_files, mkdir, rmdir, rm, pwd, cd, version } = args;
	
	let cmd = "smbclient";
	
	if (version) {
		cmd = "smbclient --version";
	} else if (list) {
		// List shares on a server
		cmd = `smbclient -L ${list}`;
		if (user) {
			cmd += ` -U ${user}`;
		}
		if (password) {
			cmd += ` -p '${password}'`;
		}
	} else if (share) {
		// Connect to a share
		let smbCmd = `smbclient '${share}'`;
		
		if (password) {
			smbCmd += ` '${password}'`;
		} else {
			smbCmd += " ''";
		}
		
		if (user) {
			smbCmd += ` -U ${user}`;
		}
		
		// Build operations
		let operations = "";
		
		if (download) {
			const parts = download.split(' ');
			if (parts.length >= 2) {
				operations += `get ${parts[0]} ${parts[1]}\n`;
			} else {
				return "Error: Download format should be 'remote-path local-path'";
			}
		} else if (upload) {
			const parts = upload.split(' ');
			if (parts.length >= 2) {
				operations += `put ${parts[0]} ${parts[1]}\n`;
			} else {
				return "Error: Upload format should be 'local-path remote-path'";
			}
		} else if (list_files) {
			operations += "ls\n";
		} else if (mkdir) {
			operations += `mkdir ${mkdir}\n`;
		} else if (rmdir) {
			operations += `rmdir ${rmdir}\n`;
		} else if (rm) {
			operations += `del ${rm}\n`;
		} else if (pwd) {
			operations += "pwd\n";
		} else if (cd) {
			operations += `cd ${cd}\n`;
		}
		
		if (operations) {
			cmd = `echo -e "${operations}quit" | ${smbCmd}`;
		} else {
			cmd = `echo -e "ls\\nquit" | ${smbCmd}`;
		}
	} else if (command) {
		cmd = command;
	} else {
		return "Error: Please provide share URL with operations (download, upload, list_files, mkdir, etc.) or list shares on a server. Use --version to see smbclient version.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}