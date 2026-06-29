import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  parseInventoryFile,
  shuffleInventory,
  exportShuffledInventory,
  type InventoryRow,
  type ShuffledRow,
} from "../utils/pharmacyShuffle";
import "./PharmacyShuffler.css";

export type ToolStatus = "idle" | "parsed" | "shuffled" | "error";

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

interface PharmacyShufflerProps {
  onStatusChange?: (status: ToolStatus) => void;
}

export default function PharmacyShuffler({ onStatusChange }: PharmacyShufflerProps) {
  const [fileName, setFileName] = useState("");
  const [originalRows, setOriginalRows] = useState<InventoryRow[]>([]);
  const [shuffledRows, setShuffledRows] = useState<ShuffledRow[]>([]);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

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
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't read this file. Please make sure it's a valid .xlsx spreadsheet and try again."
      );
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
      <div
        className={`dropzone${isDragging ? " dropzone--active" : ""}`}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onInputChange}
          className="dropzone__input"
          aria-label="Upload inventory spreadsheet"
        />
        <svg className="dropzone__icon" viewBox="0 0 40 40" aria-hidden="true">
          <path
            d="M20 6v18m0-18 6 6m-6-6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M7 27v4a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3v-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <p className="dropzone__text">
          {fileName ? `Loaded: ${fileName}` : "Drop your .xlsx file here, or click to browse"}
        </p>
        <p className="dropzone__hint">
          Your spreadsheet should include Stock Code, Drug Name, and Position columns
        </p>
      </div>

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {status === "parsed" && (
        <div className="panel" aria-live="polite">
          <p className="panel__count">{pluralize(originalRows.length, "item")} loaded</p>
          <div className="actions">
            <button className="btn btn--primary" onClick={handleShuffle}>
              Shuffle locations
            </button>
            <button className="btn btn--ghost" onClick={reset}>
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {status === "shuffled" && (
        <div className="panel" aria-live="polite">
          <p className="panel__count">{pluralize(shuffledRows.length, "item")} shuffled</p>
          <div className="actions">
            <button className="btn btn--accent" onClick={handleDownload}>
              Download shuffled .xlsx
            </button>
            <button className="btn btn--ghost" onClick={handleShuffle}>
              Re-shuffle
            </button>
            <button className="btn btn--ghost" onClick={reset}>
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
    <div className="preview">
      <p className="preview__legend">
        <span>
          <span className="legend-dot legend-dot--moved" /> moved
        </span>
        <span>
          <span className="legend-dot legend-dot--same" /> unchanged
        </span>
      </p>
      <div className="table-wrap">
        <table className="results">
          <thead>
            <tr>
              <th>Stock Code</th>
              <th>Drug Name</th>
              <th>Current position</th>
              <th>New position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const moved = r.New_Position !== r.Position;
              return (
                <tr key={i}>
                  <td>{r.Stock_Code}</td>
                  <td>{r.Drug_Name}</td>
                  <td>
                    <span className="code code--current">{r.Position}</span>
                  </td>
                  <td>
                    <span className={`code ${moved ? "code--moved" : "code--same"}`}>
                      {r.New_Position}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <p className="preview__note">
          Showing {rows.length} of {total} items. Download the file to see everything.
        </p>
      )}
    </div>
  );
}