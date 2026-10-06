import { cn } from "@alliance/shared/styles/util";

export function ExpressionEditor({
  text,
  error,
  onChange,
}: {
  text: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">
        Expression
        <textarea
          rows={2}
          className={cn(
            "mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-1",
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500",
          )}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. condition1 AND (condition2 OR NOT condition3)"
        />
      </label>
      <p className="text-[11px] text-gray-500">
        Combine rules by name with AND, OR, NOT and parentheses.
      </p>
      {error && (
        <p role="alert" className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
