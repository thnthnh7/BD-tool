import assert from "node:assert/strict";
import test from "node:test";
import { createShareId, isValidShareId } from "@/lib/share-id";
import { assertSafeZip } from "@/lib/zip-safety";

function zipDirectory(compressed: number, uncompressed: number) {
  const bytes = new Uint8Array(68);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint32(20, compressed, true);
  view.setUint32(24, uncompressed, true);
  view.setUint32(46, 0x06054b50, true);
  view.setUint16(54, 1, true);
  view.setUint16(56, 1, true);
  view.setUint32(58, 46, true);
  view.setUint32(62, 0, true);
  return bytes;
}

test("share ids have enough entropy and remain URL safe", () => {
  const id = createShareId();
  assert.equal(id.length, 22);
  assert.equal(isValidShareId(id), true);
  assert.equal(isValidShareId("../../etc/passwd"), false);
});

test("ZIP inspection rejects extreme expansion before parsing", () => {
  assert.throws(
    () => assertSafeZip(zipDirectory(1, 10_000), { maxEntries: 10, maxUncompressedBytes: 20_000, maxEntryBytes: 20_000, maxCompressionRatio: 100 }),
    /safe processing limit/,
  );
  assert.doesNotThrow(() => assertSafeZip(zipDirectory(100, 1_000), { maxEntries: 10, maxUncompressedBytes: 20_000, maxEntryBytes: 20_000, maxCompressionRatio: 100 }));
});
