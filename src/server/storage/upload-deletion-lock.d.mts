export function tryAcquireUploadDeletionLock(
  database: { name: string },
  id: string,
): (() => void) | undefined;
