import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";
import { SortDirection } from "../lib/koraParticipants";

const SortHeader: React.FC<{
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
}> = ({ label, active, direction, onSort }) => {
  const ascending = direction === SortDirection.Asc;
  return (
    <th
      className="px-3 py-2 align-top"
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex min-h-6 items-center gap-1 hover:text-zinc-900"
      >
        {label}
        {active &&
          (ascending ? (
            <ArrowUp size={14} aria-hidden />
          ) : (
            <ArrowDown size={14} aria-hidden />
          ))}
      </button>
    </th>
  );
};

export default SortHeader;
