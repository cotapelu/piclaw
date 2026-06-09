#!/usr/bin/env node

/**
 * Session Tree Command
 *
 * Provides an interactive UI to navigate the session tree.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, TreeSelectorComponent } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer } from "@earendil-works/pi-tui";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { SessionTreeNode } from "@earendil-works/pi-coding-agent/dist/core/session-manager";

class EntryDetailView {
  private entry: SessionEntry;
  private cachedLines: string[] = [];
  private cachedWidth: number | undefined;

  constructor(entry: SessionEntry) {
    this.entry = entry;
  }

  setEntry(entry: SessionEntry): void {
    this.entry = entry;
    this.cachedWidth = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const e = this.entry;
    const type = e.type;

    lines.push(`Entry ID: ${e.id}`);
    lines.push(`Parent ID: ${e.parentId ?? "<root>"}`);
    lines.push(`Type: ${type}`);
    lines.push(`Timestamp: ${new Date(e.timestamp).toLocaleString()}`);

    if (type === 'message') {
      const msgEntry = e as any;
      const msg = msgEntry.message;
      lines.push(`\n--- Message ---`);
      lines.push(`Role: ${msg.role}`);
      if ('content' in msg && msg.content) {
        const content = msg.content as any[];
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === 'text') {
              lines.push(`Text: ${c.text?.substring(0, 200) || ''}${c.text && c.text.length > 200 ? '...' : ''}`);
            } else if (c.type === 'image') {
              lines.push(`[Image: ${c.source?.mediaType || 'unknown'}]`);
            }
          }
        }
      }
    } else if (type === 'branch_summary') {
      const bs = e as any;
      lines.push(`\n--- Branch Summary ---`);
      lines.push(`From: ${bs.fromId}`);
      if (bs.summary) {
        lines.push(`Summary: ${bs.summary.substring(0, 200)}${bs.summary.length > 200 ? '...' : ''}`);
      }
    } else if (type === 'compaction') {
      const comp = e as any;
      lines.push(`\n--- Compaction Summary ---`);
      lines.push(`Tokens before: ${comp.tokensBefore ?? 'N/A'}`);
      lines.push(`First kept: ${comp.firstKeptEntryId ?? 'none'}`);
      if (comp.summary) {
        const summaryPreview = comp.summary.length > 200 ? comp.summary.substring(0, 200) + '...' : comp.summary;
        lines.push(`Summary: ${summaryPreview}`);
      }
    } else if (type === 'custom_message') {
      const cm = e as any;
      lines.push(`\n--- Custom Message ---`);
      lines.push(`Custom type: ${cm.customType}`);
      lines.push(`Display: ${cm.display}`);
      if (typeof cm.content === 'string') {
        lines.push(`Content: ${cm.content.substring(0, 200)}${cm.content.length > 200 ? '...' : ''}`);
      }
    } else if (type === 'label') {
      const label = e as any;
      lines.push(`\n--- Label ---`);
      lines.push(`Target: ${label.targetId}`);
      lines.push(`Label: ${label.label ?? "<empty>"}`);
    }

    const wrapped: string[] = [];
    for (const line of lines) {
      if (line.length <= width) {
        wrapped.push(line);
      } else {
        for (let i = 0; i < line.length; i += width) {
          wrapped.push(line.substring(i, i + width));
        }
      }
    }

    this.cachedLines = wrapped;
    this.cachedWidth = width;
    return wrapped;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = [];
  }
}

export function registerSessionTreeCommand(api: ExtensionAPI): void {
  api.registerCommand("tree", {
    description: "Show session tree browser - navigate branches and view entries",
    handler: async (_args: string, ctx) => {
      const sessionManager = ctx.sessionManager;
      if (!sessionManager) {
        ctx.ui.notify("Session manager not available", "error");
        return;
      }

      if (ctx.mode !== "tui") {
        ctx.ui.notify("/tree requires TUI mode", "error");
        return;
      }

      const tree: SessionTreeNode[] = sessionManager.getTree();
      const currentLeaf = sessionManager.getLeafId();

      const termRows = process.stdout.rows || 24;
      const termCols = process.stdout.columns || 80;
      const maxVisible = Math.max(10, termRows - 20);

      const result = await ctx.ui.custom<{ entryId: string } | null>((tui, theme, _keybindings, done) => {
        const container = new Container();

        const borderColor = (s: string) => theme.fg("accent", s);
        container.addChild(new DynamicBorder(borderColor));

        container.addChild(new Text(theme.fg("accent", theme.bold("📊 Session Tree")), 1, 0));
        container.addChild(new Spacer(1));

        // TreeSelectorComponent: constructor(tree, currentLeaf, maxVisible, initialSelectedId, filterMode, onSelect, onCancel, onLabelChange?)
        const treeList = new TreeSelectorComponent(
          tree,
          currentLeaf,
          maxVisible,
          (entryId: string) => done({ entryId }), // onSelect
          () => done(null), // onCancel
          undefined, // onLabelChange
          undefined, // initialSelectedId
          "default" as any // initialFilterMode
        );

        const detailView = new EntryDetailView({} as any);
        const treeListInternal = treeList.getTreeList?.();
        const initialSelected = treeListInternal?.getSelectedNode?.();
        if (initialSelected) {
          detailView.setEntry(initialSelected.entry);
        }

        const treeContainer = new Container();
        treeContainer.addChild(treeList);
        container.addChild(treeContainer);
        container.addChild(new Spacer(1));

        container.addChild(new Text(theme.fg("accent", "Entry Details:").bold(), 0, 0));
        container.addChild(new Spacer(1));

        const detailContainer = new Container();
        if (initialSelected) {
          const lines = detailView.render(termCols - 2);
          for (const line of lines) {
            detailContainer.addChild(new Text(line, 0, 0));
          }
        }
        container.addChild(detailContainer);

        const component = {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
            detailView.invalidate();
          },
          handleInput(data: string) {
            if (treeList.handleInput) {
              treeList.handleInput(data);
            }
            tui.requestRender();

            const treeListInternal = treeList.getTreeList?.();
            const selected = treeListInternal?.getSelectedNode?.();
            if (selected) {
              detailView.setEntry(selected.entry);
              detailContainer.clear();
              const termWidth = process.stdout.columns || 80;
              const lines = detailView.render(termWidth - 2);
              for (const line of lines) {
                detailContainer.addChild(new Text(line, 0, 0));
              }
            }
          },
        };

        container.addChild(new Spacer(1));
        container.addChild(new DynamicBorder(borderColor));

        const helpText = theme.fg("dim", "↑↓ navigate • enter select • esc cancel • / search");
        container.addChild(new Text(helpText, 1, 0));

        return component;
      });

      if (result?.entryId) {
        ctx.ui.notify(`Selected entry: ${result.entryId}`, "info");
      } else {
        ctx.ui.notify("Tree view closed", "info");
      }
    },
  });
}
