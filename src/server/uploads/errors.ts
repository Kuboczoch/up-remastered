export class UploadRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "UploadRequestError";
  }
}

export function isUploadRequestError(
  error: unknown,
): error is UploadRequestError {
  return error instanceof UploadRequestError;
}
