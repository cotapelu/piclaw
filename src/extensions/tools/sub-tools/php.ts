import { Type } from "typebox";

export const phpSchema = Type.Object({
  command: Type.String({ description: "php/composer command (e.g., 'php -v', 'php script.php', 'composer install', 'composer require laravel/framework')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executePhp(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    let cmd: string;
    if (command.startsWith("php ") || command.startsWith("php,")) {
      cmd = command;
    } else if (command.startsWith("composer ") || command.startsWith("composer,")) {
      cmd = command;
    } else {
      // Default to php
      cmd = `php ${command}`;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `php error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}