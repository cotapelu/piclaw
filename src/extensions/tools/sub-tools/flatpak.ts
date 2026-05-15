import { Type } from "typebox";

export const flatpakSchema = Type.Object({
  command: Type.String({ description: "flatpak/snap/appimage command (e.g., 'flatpak install flathub org.mozilla.Mozilla', 'flatpak run org.mozilla.Mozilla', 'snap install vlc', 'snap run vlc', './myapp.AppImage')" }),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

export async function executeFlatpak(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { command, timeout } = args as { command: string; timeout?: number };
  try {
    // Determine if it's an AppImage (starts with ./) or flatpak/snap command
    let cmd: string;
    if (command.startsWith("./") || command.endsWith(".AppImage")) {
      // AppImage - make executable and run
      cmd = `chmod +x ${command} && ${command}`;
    } else {
      // flatpak or snap command
      cmd = `${command}`;
    }
    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal, timeout });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `flatpak/snap/appimage error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}