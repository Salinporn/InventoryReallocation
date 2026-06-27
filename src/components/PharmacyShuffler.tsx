// PharmacyShuffler.tsx
import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  parseInventoryFile,
  shuffleInventory,
  exportShuffledInventory,
  type InventoryRow,
  type ShuffledRow,
} from "../utils/pharmacyShuffle";
import "./PharmacyShuffler.css";

type Status = "idle" | "parsed" | "shuffled" | "error";

export default function PharmacyShuffler() {
  const [fileName, setFileName] = useState("");
  const [originalRows, setOriginalRows] = useState<InventoryRow[]>([]);
  const [shuffledRows, setShuffledRows] = useState<ShuffledRow[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFileName("");
    setOriginalRows([]);
    setShuffledRows([]);
    setStatus("idle");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseInventoryFile(buffer);
      setOriginalRows(rows);
      setShuffledRows([]);
      setFileName(file.name);
      setStatus("parsed");
    } catch (err) {
      setStatus("error");
      setOriginalRows([]);
      setShuffledRows([]);
      setError(err instanceof Error ? err.message : "Could not read this file.");
    }
  }, []);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleShuffle = () => {
    setShuffledRows(shuffleInventory(originalRows));
    setStatus("shuffled");
  };

  const handleDownload = () => {
    const base = fileName.replace(/\.xlsx?$/i, "") || "pharmacy_inventory";
    exportShuffledInventory(shuffledRows, `${base}_shuffled.xlsx`);
  };

  return (
    <div className="pshuffle">
      <header className="pshuffle__header">
        <h2>Pharmacy Inventory Shuffle</h2>
        <p>
          Upload a stock sheet, shuffle storage locations within the same
          shelf row and drug form, then download the result. The file is
          processed entirely in your browser — nothing is uploaded or saved.
        </p>
      </header>

      <div
        className={`pshuffle__dropzone${isDragging ? " pshuffle__dropzone--active" : ""}`}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onInputChange}
          className="pshuffle__input"
        />
        <p className="pshuffle__dropzone-text">
          {fileName ? `Loaded: ${fileName}` : "Drop an .xlsx file here, or click to browse"}
        </p>
      </div>

      {error && (
        <p className="pshuffle__error" role="alert">
          {error}
        </p>
      )}

      {status === "parsed" && (
        <div className="pshuffle__panel">
          <p>{originalRows.length} item(s) loaded.</p>
          <div className="pshuffle__actions">
            <button onClick={handleShuffle}>Shuffle locations</button>
            <button className="pshuffle__secondary" onClick={reset}>
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {status === "shuffled" && (
        <div className="pshuffle__panel">
          <p>{shuffledRows.length} item(s) shuffled.</p>
          <div className="pshuffle__actions">
            <button onClick={handleDownload}>Download shuffled .xlsx</button>
            <button className="pshuffle__secondary" onClick={handleShuffle}>
              Re-shuffle
            </button>
            <button className="pshuffle__secondary" onClick={reset}>
              Start over
            </button>
          </div>
          <PreviewTable rows={shuffledRows.slice(0, 8)} total={shuffledRows.length} />
        </div>
      )}
    </div>
  );
}

function PreviewTable({ rows, total }: { rows: ShuffledRow[]; total: number }) {
  if (rows.length === 0) return null;
  return (
    <div className="pshuffle__preview">
      <table className="pshuffle__table">
        <thead>
          <tr>
            <th>Med_Name</th>
            <th>Drug_Form</th>
            <th>Current_Location</th>
            <th>New_Location</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.Med_Name}</td>
              <td>{r.Drug_Form}</td>
              <td>{r.Current_Location}</td>
              <td>{r.New_Location}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && (
        <p className="pshuffle__preview-note">
          Showing {rows.length} of {total} rows. Download the file to see all results.
        </p>
      )}
    </div>
  );
}
