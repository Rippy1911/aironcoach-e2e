import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const FCU_ENDPOINT = 'https://file-core-vault.base44.app/api/functions/uploadFile';
const WORKSPACE_ID = 'airon-e2e';

export type FcvUploadResult = {
  ok: boolean;
  upload_id: string;
  url: string;
  group_id?: string;
};

export type ArtifactRecord = {
  label: string;
  localPath: string;
  tags: string[];
  upload?: FcvUploadResult;
  error?: string;
};

function fcuKey(): string | undefined {
  return process.env.FCU_API_KEY ?? process.env.FCU_KEY;
}

/**
 * Upload a binary artifact to file-core-vault.
 * Returns null when FCU_API_KEY is not configured (caller should use GitHub Release fallback).
 */
export async function uploadToFcv(
  filePath: string,
  tags: string[],
): Promise<FcvUploadResult | null> {
  const key = fcuKey();
  if (!key) return null;

  const abs = path.resolve(filePath);
  const buffer = await fs.readFile(abs);
  const fileName = path.basename(abs);

  const form = new FormData();
  form.append('file', new Blob([buffer]), fileName);
  form.append('workspace_id', WORKSPACE_ID);
  form.append('tags', JSON.stringify(['e2e', 'wave-1', ...tags]));

  const res = await fetch(FCU_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`FCU upload failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as FcvUploadResult;
  if (!json.ok || !json.url) {
    throw new Error(`FCU upload returned unexpected payload: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function uploadArtifacts(
  artifacts: Array<{ label: string; localPath: string; tags: string[] }>,
): Promise<ArtifactRecord[]> {
  const results: ArtifactRecord[] = [];

  for (const artifact of artifacts) {
    try {
      const upload = await uploadToFcv(artifact.localPath, artifact.tags);
      results.push({ ...artifact, upload: upload ?? undefined });
    } catch (err) {
      results.push({
        ...artifact,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

export function fcuAvailable(): boolean {
  return !!fcuKey();
}
