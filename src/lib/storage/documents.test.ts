import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";

import {
  resolveStoragePath,
  privateFileResponse,
  DocumentUploadError,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from "./documents";

// Every value passed to resolveStoragePath comes from a `storage_path` column,
// and the row it came from was written from a client-supplied upload. Treat it
// as hostile.
describe("resolveStoragePath", () => {
  const root = path.resolve(process.cwd(), "storage", "documents");

  it("resolves an ordinary per-order path under the root", () => {
    expect(resolveStoragePath("order-1/file.pdf")).toBe(path.join(root, "order-1", "file.pdf"));
  });

  it.each([
    "../../../etc/passwd",
    "order-1/../../../etc/passwd",
    "order-1/../../secrets.env",
    "..",
    "../",
    "order-1/../../../../../../../../etc/shadow",
  ])("rejects traversal via %s", (attempt) => {
    expect(() => resolveStoragePath(attempt)).toThrow(DocumentUploadError);
  });

  it("rejects an absolute path that escapes the root", () => {
    expect(() => resolveStoragePath("/etc/passwd")).toThrow(DocumentUploadError);
  });

  it("does not treat a sibling directory sharing the root's prefix as inside it", () => {
    // "…/storage/documents-public" starts with "…/storage/documents" as a
    // plain string; only a separator-aware check rejects it.
    expect(() => resolveStoragePath("../documents-public/leak.pdf")).toThrow(DocumentUploadError);
  });

  describe("with a relative DOCUMENTS_STORAGE_DIR", () => {
    // A relative or trailing-slash root used to make the prefix comparison
    // compare against something that wasn't the real root.
    const original = process.env.DOCUMENTS_STORAGE_DIR;
    beforeEach(() => {
      process.env.DOCUMENTS_STORAGE_DIR = "./storage/documents/";
    });
    afterEach(() => {
      if (original === undefined) delete process.env.DOCUMENTS_STORAGE_DIR;
      else process.env.DOCUMENTS_STORAGE_DIR = original;
    });

    it("still rejects traversal", () => {
      expect(() => resolveStoragePath("../../../etc/passwd")).toThrow(DocumentUploadError);
    });
  });
});

describe("privateFileResponse", () => {
  const buffer = Buffer.from("hello");

  it("never lets a shared cache hold private bytes", () => {
    const res = privateFileResponse(buffer, { mimeType: "application/pdf", fileName: "passport.pdf" });

    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("stops the browser second-guessing the declared content type", () => {
    const res = privateFileResponse(buffer, { mimeType: "application/pdf", fileName: "passport.pdf" });

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it.each(ALLOWED_DOCUMENT_MIME_TYPES)("renders %s inline", (mimeType) => {
    const res = privateFileResponse(buffer, { mimeType, fileName: "f" });

    expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
  });

  it.each(["text/html", "image/svg+xml", "application/octet-stream", "text/xml"])(
    "downloads %s rather than rendering it in our origin",
    (mimeType) => {
      const res = privateFileResponse(buffer, { mimeType, fileName: "evil" });

      expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    }
  );

  it("reports the length of the bytes it actually read", () => {
    const res = privateFileResponse(buffer, { mimeType: "application/pdf", fileName: "f.pdf" });

    expect(res.headers.get("Content-Length")).toBe(String(buffer.byteLength));
  });

  it("escapes a filename that would otherwise break out of the header", () => {
    const res = privateFileResponse(buffer, {
      mimeType: "application/pdf",
      fileName: 'evil"; attack=1.pdf',
    });

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain('"; attack=1');
  });

  it("falls back safely when the stored mime type is missing", () => {
    const res = privateFileResponse(buffer, { mimeType: null, fileName: null });

    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  });
});
