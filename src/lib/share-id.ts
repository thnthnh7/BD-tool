const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a short URL-safe id (default 8 chars ≈ 47 bits). */
export function createShareId(length = 8) {
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
  return /^[a-zA-Z0-9]{6,16}$/.test(id);
}
