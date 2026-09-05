import { randomUUID } from "crypto";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { env } from "@/lib/env";

// Phase 2 §4: local disk storage for this phase (not S3). Files are never
// served from a public directory — access always goes through the
// RBAC-checked /api/documents/[id]/file route. Overridable via env for
// deployments that want the storage root elsewhere (e.g. a mounted volume).
export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getDocumentsStorageDir(): string {
  return env.DOCUMENTS_STORAGE_DIR || path.join(process.cwd(), "storage", "documents");
}

export class DocumentUploadError extends Error {}

export async function saveUploadedFile(
  orderId: string,
  file: File
): Promise<{ storagePath: string; originalFileName: string; mimeType: string; fileSizeBytes: number }> {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    throw new DocumentUploadError(`Unsupported file type: ${file.type || "unknown"}.`);
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new DocumentUploadError(`File too large — the maximum size is ${MAX_DOCUMENT_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
  }

  const extension = EXTENSION_BY_MIME[file.type];
  const relativeDir = orderId;
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = path.join(/* turbopackIgnore: true */ relativeDir, fileName);

  // Runtime-only, per-order path under an env-configurable storage root —
  // deliberately dynamic, not something to statically trace/bundle.
  const absoluteDir = path.join(/* turbopackIgnore: true */ getDocumentsStorageDir(), relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ absoluteDir, fileName), Buffer.from(await file.arrayBuffer()));

  return {
    storagePath: relativePath,
    originalFileName: file.name || fileName,
    mimeType: file.type,
    fileSizeBytes: file.size,
  };
}

// Resolves a DB-stored `storagePath` to an absolute path, rejecting any
// attempt at directory traversal.
export function resolveStoragePath(storagePath: string): string {
  // Resolve the root too: DOCUMENTS_STORAGE_DIR is operator-supplied and may
  // be relative or carry a trailing slash, either of which would make the
  // prefix comparison below compare against a string that isn't the real
  // root — weakening the guard it exists to provide.
  const root = path.resolve(getDocumentsStorageDir());
  const resolved = path.resolve(root, storagePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new DocumentUploadError("Invalid storage path.");
  }
  return resolved;
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ resolveStoragePath(storagePath));
}

// The single way stored bytes leave the server. Both callers serve private,
// per-user content (ID/passport scans, bank-transfer receipts) from a fixed
// URL, so the headers matter as much as the RBAC check that precedes them:
//
//  - `Cache-Control: private, no-store` — nothing in front of the app may
//    hold a response and hand it to the next requester of the same URL.
//  - `nosniff` + a sandbox CSP — mimeType comes from `file.type` in the
//    upload's multipart body, which a non-browser client controls outright,
//    and the allow-list above checks that declared type rather than the
//    file's magic bytes. These stop the browser from second-guessing the
//    type we send, and neuter script/plugin execution if it ever does.
//  - `inline` only for the types we actually intend to render in a tab;
//    anything else downloads instead of being interpreted in our origin.
//  - Content-Length from the buffer we really read, not a stored column
//    that could disagree with what is on disk.
export function privateFileResponse(
  buffer: Buffer,
  file: { mimeType: string | null; fileName: string | null }
): Response {
  const mimeType = file.mimeType ?? "application/octet-stream";
  const disposition = ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType) ? "inline" : "attachment";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(file.fileName ?? "file")}"`,
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
