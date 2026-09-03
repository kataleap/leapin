import { randomUUID } from "crypto";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";

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
  return process.env.DOCUMENTS_STORAGE_DIR || path.join(process.cwd(), "storage", "documents");
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
  const root = getDocumentsStorageDir();
  const resolved = path.resolve(root, storagePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new DocumentUploadError("Invalid storage path.");
  }
  return resolved;
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ resolveStoragePath(storagePath));
}
