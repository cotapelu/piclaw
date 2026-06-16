# Extension Template

A starter template for creating custom extensions for PiClaw.

## What's Included

- `src/my-extension.ts` – A minimal extension that registers:
  - A tool named `my-greeting` that returns a greeting.
  - A slash command `/hello` that shows a notification.

## How to Use

1. **Copy the template**
   ```bash
   cp -r extension-template src/my-extension
   ```
2. **Register the extension**  
   In `src/extensions/factory.ts`, add an import and call the aggregator:

   ```ts
   import myExtension from "./my-extension/src/my-extension.js";
   // inside extensionsAggregator:
   myExtension(api);
   ```

3. **Customize**  
   Edit `src/my-extension.ts` to implement your own tools, commands, renderers, etc.
   - Follow the ExtensionAPI patterns (see package docs).
   - Use `api.registerTool(...)` to add new tools.
   - Use `api.registerCommand(...)` to add slash commands.

4. **Build & Run**
   ```bash
   npm run build
   npm start
   ```

5. **Test**  
   Add tests under `src/my-extension/__tests__/` using Vitest.

## Resources

- PiClaw Agent Documentation
- Extension API reference: `@earendil-works/pi-coding-agent`
- Existing extensions in `src/extensions/` for examples

## License
Same as the parent project.
