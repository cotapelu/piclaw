/**
 * HTTPie sub-tool for HTTP requests - a user-friendly CLI HTTP client
 */

export const httpieSchema = {
	name: "httpie",
	description: "Make HTTP requests using HTTPie (user-friendly cURL alternative)",
	parameters: {
		type: "object",
		properties: {
			method: {
				type: "string",
				description: "HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)"
			},
			url: {
				type: "string",
				description: "URL to request"
			},
			data: {
				type: "string",
				description: "Request body data (JSON or form data)"
			},
			form: {
				type: "string",
				description: "Form fields (--form)"
			},
			headers: {
				type: "string",
				description: "Custom headers (e.g., 'Authorization: Bearer token, Content-Type: application/json')"
			},
			params: {
				type: "string",
				description: "URL parameters (e.g., 'key1=value1&key2=value2')"
			},
			auth: {
				type: "string",
				description: "Authentication (user:password or username)"
			},
			bearer: {
				type: "string",
				description: "Bearer token for authentication"
			},
			follow: {
				type: "boolean",
				description: "Follow redirects"
			},
			download: {
				type: "string",
				description: "Download output to file"
			},
			json: {
				type: "boolean",
				description: "Send JSON data (automatically sets Content-Type)"
			},
			verbose: {
				type: "boolean",
				description: "Verbose output (show request/response details)"
			},
			timeout: {
				type: "number",
				description: "Request timeout in seconds"
			},
			version: {
				type: "boolean",
				description: "Show HTTPie version"
			}
		},
		required: ["url"]
	}
};

export async function executeHttpie(args: { method?: string; url?: string; data?: string; form?: string; headers?: string; params?: string; auth?: string; bearer?: string; follow?: boolean; download?: string; json?: boolean; verbose?: boolean; timeout?: number; version?: boolean }): Promise<string> {
	const { method, url, data, form, headers, params, auth, bearer, follow, download, json, verbose, timeout, version } = args;
	
	let cmd = "http";
	
	if (version) {
		cmd = "http --version";
	} else if (url) {
		if (method) {
			cmd += ` ${method} ${url}`;
		} else {
			cmd += ` ${url}`;
		}
		
		if (follow) {
			cmd += " --follow";
		}
		
		if (verbose) {
			cmd += " --verbose";
		}
		
		if (download) {
			cmd += ` --download ${download}`;
		}
		
		if (json) {
			cmd += " --json";
		} else if (data) {
			cmd += ` ${data}`;
		}
		
		if (form) {
			cmd += ` --form ${form}`;
		}
		
		if (headers) {
			const headerParts = headers.split(',');
			for (const h of headerParts) {
				cmd += ` '${h.trim()}'`;
			}
		}
		
		if (params) {
			const paramParts = params.split('&');
			for (const p of paramParts) {
				cmd += ` '${p.trim()}'`;
			}
		}
		
		if (bearer) {
			cmd += ` 'Authorization: Bearer ${bearer}'`;
		}
		
		if (auth) {
			cmd += ` --auth '${auth}'`;
		}
		
		if (timeout) {
			cmd += ` --timeout ${timeout}`;
		}
	} else {
		return "Error: Please provide a URL. Use --version to check HTTPie version.";
	}
	
	const { exec } = await import("child_process");
	const { promisify } = await import("util");
	const execAsync = promisify(exec);
	
	try {
		const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
		return stdout || stderr;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}