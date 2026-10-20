import { useCallback } from "react";

/**
 * BOM CSV export, extracted verbatim from SimulatorPage.jsx (was the tail
 * of the export domain; downloadPng/captureThumbnail/generateSchematic stay
 * in-page until their own extraction — this one is dependency-trivial).
 *
 * Behavior contract: identical "components.csv" content + filename.
 * Verify via TopToolbox CSV download Playwright check.
 */
export function useCompCsvExport({ components }) {
  const downloadCompCsv = useCallback(() => {
    const counts = {};
    components.forEach((c) => {
      if (!counts[c.type]) counts[c.type] = { type: c.type, label: c.label, count: 0 };
      counts[c.type].count++;
    });
    const rows = Object.values(counts);
    let csv = "#,Component,Type,Quantity\n";
    rows.forEach((row, i) => {
      csv += `${i + 1},"${row.label}","${row.type}",${row.count}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "components.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }, [components]);

  return { downloadCompCsv };
}
