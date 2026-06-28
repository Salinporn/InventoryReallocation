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

const COLUMN_LABELS: Record<(typeof REQUIRED_COLUMNS)[number], string> = {
  Med_Name: "medicine name",
  Current_Location: "current location",
  Drug_Form: "drug form",
};

function extractColumnKey(header: string): string {
  const match = header.match(/\(([^)]+)\)/);
  return (match ? match[1] : header).trim();
}

export function parseInventoryFile(buffer: ArrayBuffer): InventoryRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("This spreadsheet doesn't contain any data rows. Please check the file and try again.");
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
    const friendlyMissing = missing.map((col) => COLUMN_LABELS[col]);
    throw new Error(
      `Your spreadsheet is missing column(s) for: ${friendlyMissing.join(
        ", "
      )}. Please check the header row and try again.`
    );
  }

  return rows.map((row) => ({
    Med_Name: String(row[columnMap.Med_Name!] ?? "").trim(),
    Drug_Form: String(row[columnMap.Drug_Form!] ?? "").trim(),
    Current_Location: String(row[columnMap.Current_Location!] ?? "").trim(),
  }));
}

function getRowLevel(location: string): string {
  const parts = location.split("-");
  return parts.length > 1 ? parts[1] : "Unknown";
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
