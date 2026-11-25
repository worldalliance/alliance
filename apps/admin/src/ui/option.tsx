/** One row of a filterable list (palette, command list, combobox), highlighted by keyboard or pointer. */
export const optionClass =
  "flex h-control cursor-default items-center gap-2.5 rounded-md px-2.5 outline-none data-highlighted:bg-accent-soft";

export const optionGroupLabelClass =
  "px-2.5 pt-2 pb-1 text-caption font-medium text-fg-muted";

/** An option's name, then its muted detail at the row's right edge. */
export function OptionText({
  label,
  detail,
}: {
  label: string;
  detail?: string | null;
}) {
  return (
    <>
      <span className="min-w-0 truncate">{label}</span>
      {detail && (
        <span className="ml-auto min-w-0 truncate pl-4 text-caption text-fg-muted">
          {detail}
        </span>
      )}
    </>
  );
}

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** Whether typing `query` keeps an option: its label or detail contains it, ignoring case and accents. */
export const optionMatches = (
  option: { label: string; detail?: string | null },
  query: string,
) => {
  const q = fold(query.trim());
  return (
    fold(option.label).includes(q) ||
    (!!option.detail && fold(option.detail).includes(q))
  );
};
