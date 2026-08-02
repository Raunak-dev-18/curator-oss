import { Storage } from "@google-cloud/storage";

export const storageBucket = process.env.GOOGLE_STORAGE_BUCKET;
export const isStorageConfigured = Boolean(storageBucket);

let storageClient: Storage | null = null;

declare global {
  var __cognixMemoryObjects: Map<string, Buffer> | undefined;
}

const memoryObjects = globalThis.__cognixMemoryObjects ?? (globalThis.__cognixMemoryObjects = new Map());

export function parseStorageCredentials(rawCredentials?: string) {
  if (!rawCredentials) return undefined;
  try {
    const parsed = JSON.parse(rawCredentials) as Record<string, unknown>;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") throw new Error("missing fields");
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    throw new Error(
      "GOOGLE_STORAGE_CREDENTIALS must be the complete service-account JSON object, not an email or key ID. Leave it empty to use Application Default Credentials.",
    );
  }
}

function getStorage() {
  if (storageClient) return storageClient;

  const credentials = parseStorageCredentials(process.env.GOOGLE_STORAGE_CREDENTIALS);
  storageClient = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    credentials,
  });
  return storageClient;
}

export async function uploadObject(objectKey: string, buffer: Buffer, contentType: string) {
  if (!storageBucket) {
    memoryObjects.set(objectKey, buffer);
    return { objectKey, uri: `memory://${objectKey}` };
  }

  const file = getStorage().bucket(storageBucket).file(objectKey);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=3600" },
  });
  return { objectKey, uri: `gs://${storageBucket}/${objectKey}` };
}

export async function downloadObject(objectKey: string) {
  if (!storageBucket) {
    const buffer = memoryObjects.get(objectKey);
    if (!buffer) throw new Error("The local upload is no longer available. Upload it again.");
    return buffer;
  }
  const [buffer] = await getStorage().bucket(storageBucket).file(objectKey).download();
  return buffer;
}

export async function createSignedObjectReadUrl(objectKey: string, expiresInMs = 20 * 60 * 1000) {
  if (!storageBucket) return null;
  const [url] = await getStorage().bucket(storageBucket).file(objectKey).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInMs,
  });
  return url;
}
