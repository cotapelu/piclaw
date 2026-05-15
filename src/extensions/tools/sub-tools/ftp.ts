/**
 * FTP (File Transfer Protocol) sub-tool for traditional FTP connections
 */

export const ftpSchema = {
	name: "ftp",
	description: "Transfer files using FTP protocol (non-SFTP)",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The full ftp command to execute"
			},
			host: {
				type: "string",
				description: "FTP server hostname or IP"
			},
			port: {
				type: "number",
				description: "FTP port (default: 21)"
			},
			user: {
				type: "string",
				description: "Username (default: anonymous)"
			},
			password: {
				type: "string",
				description: "Password for authentication"
			},
			passive: {
				type: "boolean",
				description: "Use passive mode (PASV)"
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
				type: "boolean",
				description: "List files in current directory"
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
			pwd: {
				type: "boolean",
				description: "Print current working directory"
			},
			cd: {
				type: "string",
				description: "Change remote directory"
			},
			version: {
				type: "boolean",
				description: "Show ftp version"
			}
		},
		required: ["command"]
	}
};

export async function executeFtp(args: { command?: string; host?: string; port?: number; user?: string; password?: string; passive?: boolean; download?: string; upload?: string; list?: boolean; mkdir?: string; rmdir?: string; rm?: string; pwd?: boolean; cd?: string; version?: boolean }): Promise<string> {
	const { command, host, port, user, password, passive, download, upload, list, mkdir, rmdir, rm, pwd, cd, version } = args;
	
	let cmd = "ftp";
	
	if (version) {
		cmd = "ftp -v 2>&1 | head -3 || echo 'ftp version info not available'";
	} else if (command) {
		cmd = command;
	} else if (host) {
		// Build ftp command with options
		let ftpCmd = "ftp";
		
		if (port && port !== 21) {
			ftpCmd += ` -p ${port}`;  // -p enables passive mode
		} else if (passive) {
			ftpCmd += " -p";  // passive mode
		}
		
		// Build the operation commands
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
		} else if (list) {
			operations += "ls -la\n";
		} else if (mkdir) {
			operations += `mkdir ${mkdir}\n`;
		} else if (rmdir) {
			operations += `rmdir ${rmdir}\n`;
		} else if (rm) {
			operations += `delete ${rm}\n`;
		} else if (pwd) {
			operations += "pwd\n";
		} else if (cd) {
			operations += `cd ${cd}\n`;
		}
		
		operations += "quit\n";
		
		// Build full command with expect or heredoc
		const ftpUser = user || "anonymous";
		const ftpPass = password || "anonymous@";
		
		// Use expect for non-interactive FTP
		cmd = `expect -c '
set timeout 30
spawn ${ftpCmd} ${host}
expect {
	"Name" { send "${ftpUser}\\n"; exp_continue }
	"Password" { send "${ftpPass}\\n" }
	"Connection refused" { puts "Error: Connection refused"; exit 1 }
	timeout { puts "Error: Timeout"; exit 1 }
}
expect {
	"ftp>" { send "${operations}" }
	"Login failed" { puts "Error: Login failed"; exit 1 }
}
expect "ftp>"
send "quit\\n"
expect eof
'`;
	} else {
		return "Error: Please provide host with operations (download, upload, list, mkdir, etc.) or a full command. Use --version to see ftp version.";
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