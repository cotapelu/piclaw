import { Type } from "typebox";

export const kafkaSchema = Type.Object({
  command: Type.Union([Type.Literal("topics"), Type.Literal("produce"), Type.Literal("consume"), Type.Literal("list-consumer-groups")]),
  bootstrapServers: Type.Optional(Type.String()),
  topic: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeKafka(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, bootstrapServers, topic, timeout } = args as {
    command: string;
    bootstrapServers?: string;
    topic?: string;
    timeout?: number;
  };

  try {
    const servers = bootstrapServers || "localhost:9092";
    let cmd = "";

    if (command === "topics") {
      cmd = `kafka-topics.sh --bootstrap-server ${servers} --list`;
    } else if (command === "produce" && topic) {
      cmd = `echo "" | kafka-console-producer.sh --bootstrap-server ${servers} --topic ${topic}`;
    } else if (command === "consume" && topic) {
      cmd = `kafka-console-consumer.sh --bootstrap-server ${servers} --topic ${topic} --from-beginning --timeout-ms 5000`;
    } else if (command === "list-consumer-groups") {
      cmd = `kafka-consumer-groups.sh --bootstrap-server ${servers} --list`;
    } else {
      return { content: [{ type: "text", text: `Invalid kafka command or missing topic` }], details: undefined, isError: true } as const;
    }

    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, command, topic },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `Kafka error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}
