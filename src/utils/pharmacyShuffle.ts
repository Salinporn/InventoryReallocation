import * as XLSX from "xlsx";

export interface InventoryRow {
  Stock_Code: string;
  Drug_Name: string;
  Position: string;
}

export interface ShuffledRow extends InventoryRow {
  New_Position: string;
}

const REQUIRED_COLUMNS = ["Stock_Code", "Drug_Name", "Position"] as const;

const COLUMN_LABELS: Record<(typeof REQUIRED_COLUMNS)[number], string> = {
  Stock_Code: "stock code",
  Drug_Name: "drug name",
  Position: "position",
};

const HEADER_ALIASES: Record<(typeof REQUIRED_COLUMNS)[number], string> = {
  Stock_Code: "Stock Code",
  Drug_Name: "Drug Name",
  Position: "Position",
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
    const alias = HEADER_ALIASES[col].toLowerCase();
    const match = headers.find((h) => {
      const key = extractColumnKey(h).toLowerCase();
      return key === col.toLowerCase() || key === alias;
    });
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
    Stock_Code: String(row[columnMap.Stock_Code!] ?? "").trim(),
    Drug_Name: String(row[columnMap.Drug_Name!] ?? "").trim(),
    Position: String(row[columnMap.Position!] ?? "").trim(),
  }));
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
  const shuffledPositions = shuffleArray(rows.map((row) => row.Position));

  return rows.map((row, idx) => ({
    ...row,
    New_Position: shuffledPositions[idx],
  }));
}

export function exportShuffledInventory(
  rows: ShuffledRow[],
  fileName = "shuffled_pharmacy_inventory.xlsx"
): void {
  const exportData = rows.map((r) => ({
    "Stock Code": r.Stock_Code,
    "Drug Name": r.Drug_Name,
    Position: r.Position,
    "New Position": r.New_Position,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shuffle Results");
  XLSX.writeFile(workbook, fileName);
}