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
import sharp from "sharp";

const MAX_IMAGE_DIMENSION = 2048;

/**
 * Resize image base64 data if it exceeds max dimension, preserving aspect ratio.
 * Uses sharp for efficient resizing.
 */
async function resizeImageIfNeeded(base64: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width <= MAX_IMAGE_DIMENSION && metadata.height <= MAX_IMAGE_DIMENSION) {
      return base64; // No resize needed
    }

    // Compute new dimensions to fit within MAX while preserving aspect ratio
    let { width, height } = metadata;
    if (width > height) {
      height = Math.round((height / width) * MAX_IMAGE_DIMENSION);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width / height) * MAX_IMAGE_DIMENSION);
      height = MAX_IMAGE_DIMENSION;
    }

    const resized = await sharp(buffer).resize(width, height).toBuffer();
    return resized.toString("base64");
  } catch (err: any) {
    logger.warn(`Image resize failed: ${err.message}`);
    return base64; // fallback to original
  }
}

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

  // Determine if it's a @file reference
  const isAtFile = arg.startsWith("@");

  // Extract the actual path (without @ if present)
  const rawPath = isAtFile ? arg.slice(1) : arg;

  // Resolve to absolute path if needed
  const resolvedPath = (rawPath.startsWith("/") || rawPath.match(/^[a-zA-Z]:\\/))
    ? rawPath
    : join(cwd, rawPath);

  // Case 1: @file syntax
  if (isAtFile) {
    const filePath = resolvedPath;

    if (!existsSync(filePath)) {
      logger.warn(`File not found: ${filePath}`);
      return { text: `[File not found: ${basename(filePath)}]`, images: [] };
    }

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
      try {
        const content = readTextFile(filePath);
        resultText.push(content);
      } catch (err: any) {
        logger.warn(`Failed to read file ${filePath}: ${err.message}`);
        resultText.push(`[Failed to read file: ${basename(filePath)}]`);
      }
    }

    return { text: resultText.join("\n"), images };
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

  // Auto-resize images if requested
  let finalImages = images;
  if (autoResizeImages && images.length > 0) {
    finalImages = await Promise.all(
      images.map(async (img) => {
        try {
          const resizedData = await resizeImageIfNeeded(img.data, img.mimeType);
          return { ...img, data: resizedData };
        } catch (err: any) {
          logger.warn(`Failed to resize image: ${err.message}`);
          return img; // fallback to original
        }
      })
    );
  }

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
    images: finalImages,
  };
}
