import { withCount } from "@alliance/common/plural";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import { useState } from "react";

export type MemberFilterOption<T extends string> = {
  value: T;
  label: string;
  memberCount: number;
};

function MemberFilterDropdown<T extends string>({
  title,
  noun,
  options,
  selected,
  onChange,
}: {
  title: string;
  noun: string;
  options: MemberFilterOption<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useOutsideClick(() => setIsOpen(false));

  const pluralLabel = title.toLowerCase();
  const selectedOptions = options.filter((option) =>
    selected.includes(option.value),
  );
  const buttonLabel = !selected.length
    ? `All ${pluralLabel}`
    : (selected.length === 1 && selectedOptions[0]?.label) ||
      withCount(selected.length, noun);

  const toggle = (value: T) =>
    onChange(
      selected.includes(value)
        ? selected.filter((selectedValue) => selectedValue !== value)
        : [...selected, value],
    );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="text-sm border border-gray-2 text-black bg-white hover:bg-zinc-50 px-3 rounded-sm py-2 flex flex-row gap-x-2 items-center"
        style={{ fontWeight: 450 }}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{buttonLabel}</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 top-[calc(100%+4px)] left-0 min-w-[220px] bg-white border border-zinc-200 rounded shadow">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200">
            <p className="text-sm font-medium text-zinc-600">{title}</p>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {options.length ? (
              options.map((option) => (
                <label
                  key={option.value}
                  className="flex flex-row items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-zinc-500">
                      {withCount(option.memberCount, "member")}
                    </span>
                  </div>
                </label>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-zinc-500">
                No {pluralLabel} yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberFilterDropdown;
