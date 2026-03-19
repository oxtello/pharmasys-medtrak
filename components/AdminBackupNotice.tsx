"use client";

import { useEffect, useState } from "react";

export default function AdminBackupNotice() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem("medtrak-backup-notice-dismissed");
    if (hidden) setDismissed(true);
  }, []);

  function dismiss() {
    localStorage.setItem("medtrak-backup-notice-dismissed", "true");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-start justify-between">
      <div>
        <strong>Backup Reminder</strong>
        <p className="mt-1">
          Ensure your MedTrak database is backed up daily. This system contains
          controlled-substance audit records.
        </p>
      </div>

      <button
        onClick={dismiss}
        className="ml-4 rounded bg-amber-600 px-3 py-1 text-white text-xs"
      >
        Dismiss
      </button>
    </div>
  );
}
