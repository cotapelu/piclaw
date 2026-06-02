#!/usr/bin/env node

/**
 * File Arguments Processor
 *
 * Handles @file syntax, image loading, and text concatenation for initial messages.
 *
 * IMPORTANT: This is Piclaw's own implementation inspired by reading llm-context.
 * We do NOT copy code. We implement clean, simple version.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { logger } from "./utils/logger.js";

// Import types from pi-ai for ImageContent (if needed)
// But we can use any shape that matches { type: 'image', mimeType, data }
type ImageContent = {
  type: "image";
  mimeType: string;
  data: string; // base64
};

/**
 * Check if a file path looks like an image based on extension
 */
export function isImagePath(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tiff"];
  return imageExtensions.includes(ext);
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Read image file and convert to base64
 */
export function readImageAsBase64(filePath: string): string {
  const buffer = readFileSync(filePath);
  return buffer.toString("base64");
}

/**
 * Load a single image as ImageContent
 */
export function loadImageAsContent(filePath: string): ImageContent {
  const mimeType = getMimeTypeFromExtension(filePath);
  const data = readImageAsBase64(filePath);
  return {
    type: "image",
    mimeType,
    data,
  };
}

/**
 * Read a text file with encoding detection
 */
export function readTextFile(filePath: string): string {
  // Try UTF-8 first
  try {
    return readFileSync(filePath, "utf-8");
  } catch (e) {
    // Fallback to binary then decode as UTF-8 with replacement
    const buffer = readFileSync(filePath);
    return buffer.toString("utf-8");
  }
}

/**
 * Process a single file argument
 * - @path → read file content (text or image)
 * - image path → load as image
 * - other → treat as literal text
 */
export function processFileArgument(
  arg: string,
  cwd: string,
  options: { autoResizeImages?: boolean } = {}
): { text: string; images: ImageContent[] } {
  const resultText: string[] = [];
  const images: ImageContent[] = [];

  // Resolve path (if not absolute, relative to cwd)
  let resolvedPath = arg;
  if (!arg.startsWith("/") && !arg.match(/^[a-zA-Z]:\\/)) {
    resolvedPath = join(cwd, arg);
  }

  // Case 1: @file syntax
  if (arg.startsWith("@")) {
    const filePath = resolvedPath.slice(1); // remove '@'

    if (!existsSync(filePath)) {
      logger.warn(`File not found: ${filePath}`);
      return { text: `[File not found: ${basename(filePath)}]`, images: [] };
    }

    // Check if it's an image
    if (isImagePath(filePath)) {
      try {
        const image = loadImageAsContent(filePath);
        images.push(image);
        resultText.push(`[Image: ${basename(filePath)} (${image.mimeType})]`);
      } catch (err: any) {
        logger.warn(`Failed to load image ${filePath}: ${err.message}`);
        resultText.push(`[Failed to load image: ${basename(filePath)}]`);
      }
    } else {
      // Read as text
      try {
        const content = readTextFile(filePath);
        resultText.push(content);
      } catch (err: any) {
        logger.warn(`Failed to read file ${filePath}: ${err.message}`);
        resultText.push(`[Failed to read file: ${basename(filePath)}]`);
      }
    }

    return {
      text: resultText.join("\n"),
      images,
    };
  }

  // Case 2: Direct image path (no @)
  if (isImagePath(arg)) {
    if (!existsSync(resolvedPath)) {
      logger.warn(`Image file not found: ${resolvedPath}`);
      return { text: `[Image not found: ${basename(arg)}]`, images: [] };
    }
    try {
      const image = loadImageAsContent(resolvedPath);
      images.push(image);
      return { text: `[Image: ${basename(arg)}]`, images };
    } catch (err: any) {
      logger.warn(`Failed to load image ${resolvedPath}: ${err.message}`);
      return { text: `[Failed to load image: ${basename(arg)}]`, images: [] };
    }
  }

  // Case 3: Plain text (literal or file path without @)
  // If file exists and is text, read it; otherwise treat as literal
  if (existsSync(resolvedPath) && !statSync(resolvedPath).isDirectory()) {
    // It's a file, but not marked with @. Should we read it?
    // Standard CLI behavior: only @ triggers file read.
    // So treat as literal text.
  }

  return { text: arg, images: [] };
}

/**
 * Process multiple file arguments
 *
 * @param fileArgs - Array of file paths or @file references
 * @param options - Processing options
 * @returns Combined text and array of images
 */
export function processFileArguments(
  fileArgs: string[],
  options: { autoResizeImages?: boolean } = {}
): { text: string; images: ImageContent[] } {
  const allText: string[] = [];
  const allImages: ImageContent[] = [];

  for (const arg of fileArgs) {
    const result = processFileArgument(arg, process.cwd(), options);
    allText.push(result.text);
    allImages.push(...result.images);
  }

  return {
    text: allText.join("\n\n"),
    images: allImages,
  };
}

/**
 * Build initial message from files and stdin
 *
 * @param fileArgs - File arguments from CLI
 * @param stdinContent - Content from stdin (if any)
 * @param autoResizeImages - Whether to auto-resize images (unused for now)
 * @returns Combined message text and images
 */
export async function buildInitialMessage(
  fileArgs: string[],
  stdinContent: string | undefined,
  autoResizeImages?: boolean
): Promise<{ text: string; images: ImageContent[] }> {
  const { text: fileText, images } = processFileArguments(fileArgs, { autoResizeImages });

  // Combine file text + stdin
  const parts: string[] = [];
  if (fileText) {
    parts.push(fileText);
  }
  if (stdinContent) {
    parts.push(stdinContent);
  }

  return {
    text: parts.join("\n\n").trim(),
    images,
  };
}
