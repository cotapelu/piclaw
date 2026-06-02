import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isImagePath,
  getMimeTypeFromExtension,
  readTextFile,
  readImageAsBase64,
  loadImageAsContent,
  processFileArgument,
  processFileArguments,
  buildInitialMessage,
} from "../file-processor";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("FileProcessor", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync("/tmp/piclaw-test-");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("isImagePath", () => {
    it("detects image extensions", () => {
      expect(isImagePath("image.png")).toBe(true);
      expect(isImagePath("photo.jpg")).toBe(true);
      expect(isImagePath("anim.gif")).toBe(true);
      expect(isImagePath("vector.svg")).toBe(true);
      expect(isImagePath("img.webp")).toBe(true);
      expect(isImagePath("doc.bmp")).toBe(true);
      expect(isImagePath("pic.tiff")).toBe(true);
    });

    it("detects non-image files", () => {
      expect(isImagePath("text.txt")).toBe(false);
      expect(isImagePath("script.js")).toBe(false);
      expect(isImagePath("data.json")).toBe(false);
      expect(isImagePath("file")).toBe(false);
    });

    it("is case insensitive", () => {
      expect(isImagePath("IMAGE.PNG")).toBe(true);
      expect(isImagePath("Photo.JPEG")).toBe(true);
    });
  });

  describe("getMimeTypeFromExtension", () => {
    it("returns correct MIME types", () => {
      expect(getMimeTypeFromExtension("file.png")).toBe("image/png");
      expect(getMimeTypeFromExtension("file.jpg")).toBe("image/jpeg");
      expect(getMimeTypeFromExtension("file.jpeg")).toBe("image/jpeg");
      expect(getMimeTypeFromExtension("file.gif")).toBe("image/gif");
      expect(getMimeTypeFromExtension("file.webp")).toBe("image/webp");
      expect(getMimeTypeFromExtension("file.svg")).toBe("image/svg+xml");
    });

    it("falls back for unknown extensions", () => {
      expect(getMimeTypeFromExtension("file.unknown")).toBe("application/octet-stream");
      expect(getMimeTypeFromExtension("file.txt")).toBe("application/octet-stream");
    });
  });

  describe("readTextFile", () => {
    it("reads UTF-8 text", () => {
      const file = join(tempDir, "utf8.txt");
      writeFileSync(file, "Hello, 世界!");

      const content = readTextFile(file);
      expect(content).toBe("Hello, 世界!");
    });

    it("handles files with non-UTF-8 bytes by fallback", () => {
      const file = join(tempDir, "binary.dat");
      // Write some invalid UTF-8 sequence
      writeFileSync(file, Buffer.from([0xff, 0xfe, 0xfd]));

      // Should not throw, fallback to buffer.toString('utf-8') with replacement
      const content = readTextFile(file);
      expect(typeof content).toBe("string");
    });
  });

  describe("readImageAsBase64", () => {
    it("reads image and returns base64", () => {
      const file = join(tempDir, "test.png");
      const originalData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG signature
      writeFileSync(file, originalData);

      const base64 = readImageAsBase64(file);
      expect(base64).toBe(originalData.toString("base64"));
    });
  });

  describe("loadImageAsContent", () => {
    it("creates ImageContent with correct mime and data", () => {
      const file = join(tempDir, "test.jpg");
      const data = Buffer.from([0xff, 0xd8, 0xff]); // JPEG signature
      writeFileSync(file, data);

      const image = loadImageAsContent(file);
      expect(image.type).toBe("image");
      expect(image.mimeType).toBe("image/jpeg");
      expect(image.data).toBe(data.toString("base64"));
    });
  });

  describe("processFileArgument with @ syntax", () => {
    it("processes text file", () => {
      const file = join(tempDir, "notes.txt");
      writeFileSync(file, "Important notes");

      const result = processFileArgument(`@${file}`, tempDir);
      expect(result.text).toBe("Important notes");
      expect(result.images).toEqual([]);
    });

    it("processes image file as image content", () => {
      const file = join(tempDir, "diagram.png");
      const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      writeFileSync(file, data);

      const result = processFileArgument(`@${file}`, tempDir);
      expect(result.text).toContain("[Image:");
      expect(result.images).toHaveLength(1);
      expect(result.images[0].type).toBe("image");
      expect(result.images[0].mimeType).toBe("image/png");
      expect(result.images[0].data).toBe(data.toString("base64"));
    });

    it("handles missing @file gracefully", () => {
      const missing = join(tempDir, "missing.txt");
      const result = processFileArgument(`@${missing}`, tempDir);
      expect(result.text).toContain("File not found");
      expect(result.images).toEqual([]);
    });

    it("resolves @file relative to cwd", () => {
      const subdir = join(tempDir, "sub");
      mkdirSync(subdir, { recursive: true });
      const file = join(subdir, "rel.txt");
      writeFileSync(file, "Relative content");

      const result = processFileArgument("@sub/rel.txt", tempDir);
      expect(result.text).toBe("Relative content");
    });
  });

  describe("processFileArgument with direct image path", () => {
    it("loads image without @ prefix", () => {
      const file = join(tempDir, "img.gif");
      const data = Buffer.from([0x47, 0x49, 0x46]); // GIF signature
      writeFileSync(file, data);

      const result = processFileArgument(file, tempDir);
      expect(result.text).toBe("[Image: img.gif]");
      expect(result.images).toHaveLength(1);
      expect(result.images[0].mimeType).toBe("image/gif");
    });

    it("handles missing image file", () => {
      const result = processFileArgument(join(tempDir, "missing.png"), tempDir);
      expect(result.text).toContain("[Image not found:");
      expect(result.images).toEqual([]);
    });
  });

  describe("processFileArgument with plain text", () => {
    it("treats non-file literal as text", () => {
      const result = processFileArgument("hello world", tempDir);
      expect(result.text).toBe("hello world");
      expect(result.images).toEqual([]);
    });

    it("handles existing file without @ as literal (not auto-read)", () => {
      const file = join(tempDir, "file.txt");
      writeFileSync(file, "file content");

      const result = processFileArgument(file, tempDir);
      // Without @, it's treated as literal (the argument itself)
      expect(result.text).toBe(file);
      expect(result.images).toEqual([]);
    });
  });

  describe("processFileArguments", () => {
    it("combines multiple arguments", () => {
      const file1 = join(tempDir, "a.txt");
      const file2 = join(tempDir, "b.txt");
      writeFileSync(file1, "A");
      writeFileSync(file2, "B");

      const result = processFileArguments([`@${file1}`, file2]);
      expect(result.text).toContain("A");
      // file2 without '@' appears as literal path
      expect(result.text).toContain(file2);
    });

    it("aggregates images from all arguments", () => {
      const img1 = join(tempDir, "1.png");
      const img2 = join(tempDir, "2.png");
      writeFileSync(img1, Buffer.from([0x89, 0x50]));
      writeFileSync(img2, Buffer.from([0x89, 0x51]));

      const result = processFileArguments([`@${img1}`, img2]);
      expect(result.images).toHaveLength(2);
    });
  });

  describe("buildInitialMessage", () => {
    it("combines file text and stdin", async () => {
      const file = join(tempDir, "notes.txt");
      writeFileSync(file, "From file");

      const result = await buildInitialMessage([`@${file}`], "From stdin");
      expect(result.text).toContain("From file");
      expect(result.text).toContain("From stdin");
    });

    it("handles no files and no stdin", async () => {
      const result = await buildInitialMessage([], undefined);
      expect(result.text).toBe("");
    });

    it("passes through images", async () => {
      const img = join(tempDir, "pic.png");
      writeFileSync(img, Buffer.from([0x89, 0x50]));

      const result = await buildInitialMessage([`@${img}`], undefined);
      expect(result.images).toHaveLength(1);
    });
  });
});
