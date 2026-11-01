// Module worker: keeps pdf-lib's parsing/merging off the main thread.
// Protocol: { id, parts } in, { id, ok, bytes | error } out.

import { mergePdfParts } from "./pdf-merge";

interface MergeRequest {
  id: string;
  parts: ArrayBuffer[];
}

type MergeResponse =
  | { id: string; ok: true; bytes: Uint8Array }
  | { id: string; ok: false; error: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<MergeRequest>) => void) | null;
  postMessage(message: MergeResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event: MessageEvent<MergeRequest>) => {
  const { id, parts } = event.data;
  try {
    const bytes = await mergePdfParts(parts);
    const response: MergeResponse = { id, ok: true, bytes };
    scope.postMessage(response, [bytes.buffer as ArrayBuffer]);
  } catch (error) {
    const response: MergeResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Merge failed.",
    };
    scope.postMessage(response);
  }
};
