const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;

export type ZipSafetyLimits = {
  maxEntries: number;
  maxUncompressedBytes: number;
  maxEntryBytes: number;
  maxCompressionRatio: number;
};

/** Inspect ZIP metadata before handing an archive to a full document parser. */
export function assertSafeZip(bytes: Uint8Array, limits: ZipSafetyLimits) {
  if (bytes.byteLength < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("The uploaded file is not a valid ZIP-based document.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchStart = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("The uploaded archive is incomplete.");

  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || centralDisk !== 0 || entries === 0xffff || centralOffset === 0xffffffff) {
    throw new Error("Multi-part and ZIP64 documents are not supported.");
  }
  if (entries > limits.maxEntries || centralOffset + centralSize > bytes.byteLength) {
    throw new Error("The uploaded archive contains too many files or invalid metadata.");
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_FILE_SIGNATURE) {
      throw new Error("The uploaded archive directory is invalid.");
    }
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    totalUncompressed += uncompressed;
    const ratio = uncompressed / Math.max(1, compressed);
    if (uncompressed > limits.maxEntryBytes || totalUncompressed > limits.maxUncompressedBytes || ratio > limits.maxCompressionRatio) {
      throw new Error("The uploaded archive expands beyond the safe processing limit.");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
}
