import Button from "@alliance/shared/ui/Button";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import React, { useRef, useState } from "react";

interface ExportableFlyerProps {
  filename?: string;

  scale?: number;
  includeBackground?: boolean;
  showPreview?: boolean;
  children: React.ReactNode;
}

const ExportableFlyer: React.FC<ExportableFlyerProps> = ({
  filename = "document.pdf",
  scale = 2, // multiplier for html2canvas to improve resolution (1 = baseline)
  includeBackground = true,
  children,
}: ExportableFlyerProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!wrapperRef.current) return;
    setExporting(true);
    try {
      // html2canvas will respect CSS units; using scale to increase resolution.
      const canvas = await html2canvas(wrapperRef.current, {
        scale: Math.max(1, scale * (window.devicePixelRatio || 1)),
        useCORS: true,
        backgroundColor: includeBackground ? null : "transparent",
        scrollY: -window.scrollY, // helps if page scrolled
      });

      const imgData = canvas.toDataURL("image/png");

      // Create PDF with units in inches. Format is [width, height]
      const pdf = new jsPDF({ unit: "in", format: [8, 11] });

      // Add image filling the page (position x=0,y=0, width=8in, height=11in)
      pdf.addImage(imgData, "PNG", 0, 0, 8, 11);

      pdf.save(filename);
    } catch (err) {
      // Surface the error to console and continue
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Export to PDF"}
        </Button>

        <p className="text-zinc-500">{filename}</p>
      </div>

      <div
        ref={wrapperRef}
        className="mx-auto p-[0.8in] border border-zinc-200"
        style={{
          width: "8in",
          height: "11in",
          background: includeBackground ? "white" : "transparent",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ExportableFlyer;
