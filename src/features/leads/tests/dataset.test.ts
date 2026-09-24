import assert from "node:assert/strict";
import { test } from "node:test";
import { datasetColumns, datasetCsv, datasetRaw, datasetValue, defaultDatasetColumns, filterDataset, safeDatasetUrl, sortDataset, type DatasetRow } from "../dataset";
import { readAllPages } from "../server/read-pages";

test("discovers late and nested fields without confusing literal dots with paths", () => {
  const rows: DatasetRow[] = Array.from({ length: 1205 }, (_, index) => ({ id: String(index), label: String(index), data: { title: `Item ${index}`, count: index } }));
  rows[1204].data = { ...rows[1204].data, lateField: "searchable", owner: { name: "nested" }, "owner.name": "literal", results: [{ url: "https://example.com" }] };
  const columns = datasetColumns(rows);
  assert.ok(columns.some((column) => column.label === "lateField"));
  assert.equal(datasetValue(rows[1204].data, ["owner", "name"]), "nested");
  assert.equal(datasetValue(rows[1204].data, ["owner.name"]), "literal");
  assert.equal(filterDataset(rows, "searchable").length, 1);
  assert.equal(filterDataset(rows, "example.com").length, 1);
  assert.equal(defaultDatasetColumns(columns).length, 6);
});

test("numeric sort, false, zero, missing values and CSV formulas preserve their meaning", () => {
  const rows: DatasetRow[] = [
    { id: "a", label: "A", data: { title: '=HYPERLINK("https://example.com")', count: 10, verified: false } },
    { id: "b", label: "B", data: { title: 'Cà phê, "Đẹp"\nQ1', count: 2, verified: true } },
    { id: "c", label: "C", data: { title: "Zero", count: 0 } },
    { id: "d", label: "D", data: { title: "Missing" } },
  ];
  const columns = datasetColumns(rows);
  const count = columns.find((column) => column.label === "count")!;
  assert.deepEqual(sortDataset(rows, count, false).map((row) => row.id), ["c", "b", "a", "d"]);
  assert.deepEqual(sortDataset(rows, count, true).map((row) => row.id), ["a", "b", "c", "d"]);
  const csv = datasetCsv(rows, columns);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(csv.includes('"false"'));
  assert.ok(csv.includes('"0"'));
  assert.ok(csv.includes('"Cà phê, ""Đẹp""\nQ1"'));
  assert.equal(safeDatasetUrl("javascript:alert(1)"), null);
  assert.equal(safeDatasetUrl("data:text/html,test"), null);
  assert.equal(safeDatasetUrl("https://example.com"), "https://example.com/");
});

test("removes internal marker while keeping original nested data", () => {
  assert.deepEqual(datasetRaw({ ingest_key: 1, name: "A", child: { ingest_key: "actor-value" } }), { name: "A", child: { ingest_key: "actor-value" } });
});

test("readAllPages reads past the PostgREST cap and propagates errors", async () => {
  const all = Array.from({ length: 1307 }, (_, index) => ({ id: index }));
  const result = await readAllPages(async (from, to) => ({ data: all.slice(from, Math.min(to + 1, from + 117)), error: null }));
  assert.deepEqual(result, all);
  await assert.rejects(readAllPages(async () => ({ data: null, error: { message: "RLS/query failed" } })), /RLS\/query failed/);
});
