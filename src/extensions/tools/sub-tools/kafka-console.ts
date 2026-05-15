import { Type } from "typebox";

export const kafkaConsoleSchema = Type.Object({
  command: Type.String({ description: "kafka-console-producer/consumer command (e.g., 'producer --broker-list localhost:9092 --topic mytopic', 'consumer --bootstrap-server localhost:9092 --topic mytopic')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeKafkaConsole(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout = 30000 } = args as { command: string; timeout?: number };
  try {
    const parts = command ? command.split(/ \\s+/) : [];
    if (parts.length === 0) {
      return { content: [{ type: "text", text: "kafka-console command required (producer/consumer)" }], details: undefined, isError: true } as const;
    }
    const tool = `kafka-console-${parts.shift()!}`;
    const kafkaArgs = [tool, ...parts];
    const result = await ctx!.exec(tool, kafkaArgs.slice(1), { cwd, signal, timeout }); // exec by tool name directly? Better: exec whole args with tool as command
    // Actually: we want to run 'kafka-console-producer --broker-list ...'
    // So we use tool as command and pass remaining args
    const result2 = await ctx!.exec(tool, kafkaArgs.slice(1), { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result2.stdout || result2.stderr }],
      details: { exitCode: result2.code, killed: result2.killed },
      isError: result2.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `kafka-console error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}