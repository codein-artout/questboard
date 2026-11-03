import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

/** Where uploaded files live. Keys are opaque, e.g. "quests/<id>/<uuid>.jpg". */
export interface StorageProvider {
  name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");
const safeKey = (key: string) => {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
};

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export const localDiskProvider: StorageProvider = {
  name: "local",
  async put(key, body) {
    const file = path.join(LOCAL_ROOT, safeKey(key));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  },
  async get(key) {
    try {
      const body = await readFile(path.join(LOCAL_ROOT, safeKey(key)));
      const ext = key.split(".").pop()?.toLowerCase() ?? "";
      return { body: new Uint8Array(body), contentType: TYPES[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  },
  async delete(key) {
    await unlink(path.join(LOCAL_ROOT, safeKey(key))).catch(() => undefined);
  },
  publicUrl: (key) => `/api/uploads/${safeKey(key)}`,
};

/** Any S3-compatible store (AWS S3, Cloudflare R2, MinIO), signed with SigV4. */
export function s3Provider(opts: { bucket: string; region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string; publicUrl?: string }): StorageProvider {
  const client = new AwsClient({ accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey, region: opts.region, service: "s3" });
  const base = (opts.endpoint ? `${opts.endpoint.replace(/\/$/, "")}/${opts.bucket}` : `https://${opts.bucket}.s3.${opts.region}.amazonaws.com`);
  const url = (key: string) => `${base}/${safeKey(key)}`;
  return {
    name: "s3",
    async put(key, body, contentType) {
      const res = await client.fetch(url(key), { method: "PUT", body: new Blob([body as BlobPart]), headers: { "Content-Type": contentType } });
      if (!res.ok) throw new Error(`S3 put failed: ${res.status}`);
    },
    async get(key) {
      const res = await client.fetch(url(key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 get failed: ${res.status}`);
      return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
    },
    async delete(key) {
      await client.fetch(url(key), { method: "DELETE" });
    },
    publicUrl: (key) => (opts.publicUrl ? `${opts.publicUrl.replace(/\/$/, "")}/${safeKey(key)}` : `/api/uploads/${safeKey(key)}`),
  };
}

export function storage(): StorageProvider {
  const e = process.env;
  if (e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY) {
    return s3Provider({
      bucket: e.S3_BUCKET,
      region: e.S3_REGION || "auto",
      endpoint: e.S3_ENDPOINT || undefined,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      publicUrl: e.S3_PUBLIC_URL || undefined,
    });
  }
  return localDiskProvider;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

/** Checks magic bytes so a renamed file can't pass as an image. */
export function sniffImage(bytes: Uint8Array): (typeof IMAGE_TYPES)[number] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  return null;
}
