import { cn } from "./cn";

export default function CharacterLimitNotice({
  value,
  max,
  readOnly = false,
}: {
  value: string;
  max: number;
  readOnly?: boolean;
}) {
  const atLimit = !readOnly && value.length >= max;
  return (
    <p
      className={cn(
        "mt-1 text-caption",
        atLimit ? "text-warning" : "text-fg-muted",
      )}
      role="status"
    >
      {atLimit ? `${max} character limit reached` : `Maximum ${max} characters`}
    </p>
  );
}
