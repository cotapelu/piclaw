#!/usr/bin/env node
/**
 * Component Serialization for Renderer Isolation
 *
 * Converts TUI Component instances to/from plain JSON descriptors.
 * Initially supports Text (and can be extended to others).
 */

import { Text, type Component } from "@earendil-works/pi-tui";

/**
 * Serializable descriptor for supported components.
 * Currently: Text
 */
export type SerializableComponent =
  | { type: 'Text'; text: string; paddingX?: number; paddingY?: number }
  // Future: Markdown, Box, Container, Spacer, etc.

/**
 * Convert a Component instance to a SerializableComponent descriptor.
 * Supports Text and falls back to plain text representation if unknown.
 */
export function componentToDescriptor(comp: Component): SerializableComponent {
  // Text is the most common. Check using instanceof.
  // Note: We rely on the actual Text class reference from pi-tui.
  if (comp instanceof Text) {
    // Access private fields via any to avoid TS errors.
    const anyComp = comp as any;
    return {
      type: 'Text',
      text: anyComp.text ?? '',
      paddingX: anyComp.paddingX ?? 1,
      paddingY: anyComp.paddingY ?? 1,
    };
  }

  // For unsupported components, try to render to text as fallback.
  try {
    const lines = comp.render?.(Infinity);
    if (Array.isArray(lines)) {
      return { type: 'Text', text: lines.join('\n') };
    }
  } catch {
    // ignore
  }

  // Ultimate fallback: generic unknown
  return { type: 'Text', text: '[Unsupported component]' };
}

/**
 * Build an actual TUI Component from a SerializableComponent descriptor.
 */
export function descriptorToComponent(desc: SerializableComponent): Component {
  switch (desc.type) {
    case 'Text':
      return new Text(desc.text, desc.paddingX ?? 1, desc.paddingY ?? 1);
    // Future cases for other types
    default:
      return new Text(`[Unknown component type: ${(desc as any).type}]`);
  }
}
