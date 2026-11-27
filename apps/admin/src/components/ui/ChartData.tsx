import { cn } from "@alliance/shared/styles/util";
import { useState } from "react";
import Disclosure from "../Disclosure";

type ChartDataProps = {
  caption: string;
  columns: readonly string[];
  /** One row per plotted point; the first cell heads the row. */
  rows: readonly (readonly string[])[];
};

const ChartData = ({ caption, columns, rows }: ChartDataProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 text-sm">
      <Disclosure
        summary={
          <>
            Show data<span className="sr-only"> for {caption}</span>
          </>
        }
        summaryClassName="w-fit text-zinc-600"
        onToggle={setOpen}
      >
        {open && (
          <div
            role="region"
            aria-label={caption}
            tabIndex={0}
            className="mt-2 max-h-96 overflow-auto rounded-md border border-zinc-200 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead className="sticky top-0 bg-zinc-50">
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      scope="col"
                      className={cn(
                        "px-3 py-1.5 font-medium text-zinc-600",
                        index > 0 && "text-right",
                      )}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map(([head, ...cells], rowIndex) => (
                  <tr key={rowIndex}>
                    <th
                      scope="row"
                      className="px-3 py-1 font-normal text-zinc-800"
                    >
                      {head}
                    </th>
                    {cells.map((cell, index) => (
                      <td
                        key={index}
                        className="px-3 py-1 text-right tabular-nums text-zinc-800"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Disclosure>
    </div>
  );
};

export default ChartData;
