// pharmacyShuffle.ts
// Pure, framework-agnostic logic for the Pharmacy Inventory shuffler.
// Requires: npm install xlsx

import * as XLSX from "xlsx";

export interface InventoryRow {
  Med_Name: string;
  Drug_Form: string;
  Current_Location: string;
}

export interface ShuffledRow extends InventoryRow {
  New_Location: string;
}

const REQUIRED_COLUMNS = ["Med_Name", "Current_Location", "Drug_Form"] as const;

/**
 * Pulls the matchable key out of a header. "ชื่อยา (Med_Name)" -> "Med_Name".
 * Headers with no parentheses are returned as-is.
 */
function extractColumnKey(header: string): string {
  const match = header.match(/\(([^)]+)\)/);
  return (match ? match[1] : header).trim();
}

/**
 * Reads an .xlsx file's first sheet into typed rows.
 * Throws a descriptive Error if required columns are missing.
 *
 * Header matching is tolerant of bilingual headers like
 * "ชื่อยา (Med_Name)" — it matches on the text inside the parentheses
 * if present, otherwise on the whole header, case-insensitively.
 */
export function parseInventoryFile(buffer: ArrayBuffer): InventoryRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("The spreadsheet has no data rows.");
  }

  const headers = Object.keys(rows[0]);
  const columnMap: Partial<Record<(typeof REQUIRED_COLUMNS)[number], string>> = {};

  for (const col of REQUIRED_COLUMNS) {
    const match = headers.find(
      (h) => extractColumnKey(h).toLowerCase() === col.toLowerCase()
    );
    if (match) columnMap[col] = match;
  }

  const missing = REQUIRED_COLUMNS.filter((col) => !columnMap[col]);
  if (missing.length > 0) {
    throw new Error(
      `The Excel file is missing required column(s): ${missing.join(
        ", "
      )}. Found headers: ${headers.join(", ")}`
    );
  }

  return rows.map((row) => ({
    Med_Name: String(row[columnMap.Med_Name!] ?? "").trim(),
    Drug_Form: String(row[columnMap.Drug_Form!] ?? "").trim(),
    Current_Location: String(row[columnMap.Current_Location!] ?? "").trim(),
  }));
}

/**
 * Extracts the shelf/row level from a location code like "A1-08-02" -> "08".
 * Mirrors the Python: x.split('-')[1] if available, else 'Unknown'.
 */
function getRowLevel(location: string): string {
  const parts = location.split("-");
  return parts.length > 1 ? parts[1] : "Unknown";
}

/** Fisher-Yates shuffle, returns a new array (does not mutate input). */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles Current_Location values within groups that share the same
 * Row_Level + Drug_Form, exactly like the reference Python script's
 * groupby('Row_Level' + '_' + 'Drug_Form') + random.shuffle logic.
 */
export function shuffleInventory(rows: InventoryRow[]): ShuffledRow[] {
  const groups = new Map<string, number[]>();

  rows.forEach((row, idx) => {
    const key = `${getRowLevel(row.Current_Location)}_${row.Drug_Form}`;
    const indices = groups.get(key);
    if (indices) {
      indices.push(idx);
    } else {
      groups.set(key, [idx]);
    }
  });

  const newLocations = new Array<string>(rows.length);

  groups.forEach((indices) => {
    const locationsInGroup = indices.map((i) => rows[i].Current_Location);
    const shuffled = shuffleArray(locationsInGroup);
    indices.forEach((rowIdx, i) => {
      newLocations[rowIdx] = shuffled[i];
    });
  });

  return rows.map((row, idx) => ({
    ...row,
    New_Location: newLocations[idx],
  }));
}

/**
 * Builds an .xlsx workbook from shuffled rows and triggers a browser
 * download. Nothing is sent to a server or persisted anywhere — the
 * workbook is built and downloaded entirely in memory.
 */
export function exportShuffledInventory(
  rows: ShuffledRow[],
  fileName = "shuffled_pharmacy_inventory.xlsx"
): void {
  const exportData = rows.map((r) => ({
    Med_Name: r.Med_Name,
    Drug_Form: r.Drug_Form,
    Current_Location: r.Current_Location,
    New_Location: r.New_Location,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shuffle Results");
  XLSX.writeFile(workbook, fileName);
}
