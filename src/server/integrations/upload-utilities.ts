export type PublicUploadConfiguration = {
  defaultFileLifetime: number;
  maxFileLifetime: number;
  maxPermanentFileSize: number;
  maxTemporaryFileSize: number;
  permanentAllowed: boolean;
};

export function createPublicUploadConfiguration(limits: {
  defaultExpirationMs: number;
  maxExpirationMs: number;
  maxUploadBytes: number;
}): PublicUploadConfiguration {
  return {
    defaultFileLifetime: limits.defaultExpirationMs,
    maxFileLifetime: limits.maxExpirationMs,
    maxPermanentFileSize: 0,
    maxTemporaryFileSize: limits.maxUploadBytes,
    permanentAllowed: false,
  };
}

export function createShareXConfiguration(origin: string) {
  return {
    Body: "MultipartFormData",
    DestinationType: "ImageUploader, TextUploader, FileUploader",
    FileFormName: "file",
    Name: "UP file hosting",
    RequestMethod: "POST",
    RequestURL: `${origin}/api/upload`,
    URL: `${origin}/u/$json:key$`,
    Version: "13.1.0",
  };
}

export function createShellUploadScript(origin: string): string {
  return [
    "#!/bin/sh",
    "set -eu",
    "",
    'if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then',
    '  echo "Usage: $0 FILE" >&2',
    "  exit 64",
    "fi",
    "",
    'response=$(curl --fail-with-body --silent --show-error --request POST --form "file=@$1" ' +
      `'${origin}/api/upload')`,
    String.raw`key=$(printf '%s' "$response" | sed -n 's/.*"key"[[:space:]]*:[[:space:]]*"\([0-9A-Za-z]\{5\}\)".*/\1/p')`,
    'if [ -z "$key" ]; then',
    '  echo "Upload response did not contain a valid key." >&2',
    "  exit 65",
    "fi",
    "",
    `printf '%s/u/%s\n' '${origin}' "$key"`,
    "",
  ].join("\n");
}
