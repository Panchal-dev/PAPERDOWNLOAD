// Status line under the form: live region for loading/success/error.
// Screen readers announce changes via aria-live="polite".

import { DOWNLOAD_STATUS } from "@/constants/download.constants";
import type { DownloadStatus } from "@/constants/download.constants";
import { Alert } from "@/components/ui/alert";

export function DownloadStatus({
  status,
  error,
}: {
  status: DownloadStatus;
  error: string | null;
}) {
  if (status === DOWNLOAD_STATUS.loading) {
    return (
      <div aria-live="polite">
        <Alert tone="info">Fetching papers from the GTU archive…</Alert>
      </div>
    );
  }
  if (status === DOWNLOAD_STATUS.error && error) {
    return (
      <div aria-live="polite">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }
  return null;
}
