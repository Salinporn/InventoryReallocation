import { useState } from "react";
import PharmacyShuffler, { type ToolStatus } from "./components/PharmacyShuffler";
import "./App.css";

const STEPS: { label: string; statuses: ToolStatus[] }[] = [
  { label: "Upload Inventory", statuses: ["idle", "error"] },
  { label: "Generate New Locations", statuses: ["parsed"] },
  { label: "Download result", statuses: ["shuffled"] },
];

function stepState(index: number, status: ToolStatus): "done" | "active" | "" {
  const activeIndex = STEPS.findIndex((s) => s.statuses.includes(status));
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "";
}

function App() {
  const [status, setStatus] = useState<ToolStatus>("idle");

  return (
    <div className="page">
      <header className="bar">
        <svg className="bar__mark" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="var(--apothecary-dark)" />
          <path d="M11 5h2v14h-2z" fill="var(--paper)" />
          <path d="M5 11h14v2H5z" fill="var(--paper)" />
        </svg>
        <div className="bar__text">
          <span className="bar__title">Pharmacy Inventory Reallocation</span>
          <span className="bar__tag">RX · PRIVATE &amp; SECURE</span>
        </div>
      </header>

      <section className="hero">
        <h1>Reassign medication storage locations automatically.</h1>
        <p>
          Upload your pharmacy inventory spreadsheet, shuffle storage locations within
          the same shelf row and drug form, then download the result.
        </p>
      </section>

      <ol className="steps">
        {STEPS.map((step, i) => {
          const state = stepState(i, status);
          return (
            <li key={step.label} className={`step ${state ? `step--${state}` : ""}`}>
              <span className="step__num">{state === "done" ? "✓" : i + 1}</span>
              <span className="step__label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="ticket">
        <PharmacyShuffler onStatusChange={setStatus} />
      </div>

      <p className="footnote">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4 7V5.5a4 4 0 1 1 8 0V7h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1.4 0h5.2V5.5a2.6 2.6 0 1 0-5.2 0V7Z"
            fill="currentColor"
          />
        </svg>
        Processed entirely on your device. Your spreadsheet is never uploaded, stored, or logged. Refresh the page to start over.
      </p>
    </div>
  );
}

export default App;