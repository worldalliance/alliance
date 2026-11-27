import type React from "react";
import { Input } from "./Input";

/**
 * A calendar date with no time, for a date range. The value is `YYYY-MM-DD`,
 * or "" when blank; `lib/dateInput.ts` turns it into the instants a query needs.
 */
export function DateField({
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      type="date"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
