const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate an unguessable URL-safe id (default 22 chars, over 128 bits). */
export function createShareId(length = 22) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = "";
  for (let i = 0; i < length; i += 1) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

export function shareBlobPath(id: string) {
  return `shares/${id}.json`;
}

export function isValidShareId(id: string) {
  return /^[a-zA-Z0-9]{6,32}$/.test(id);
}
