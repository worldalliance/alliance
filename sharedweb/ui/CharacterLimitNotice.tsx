import { cn } from "@alliance/shared/styles/util";

export default function CharacterLimitNotice({
  value,
  max,
}: {
  value: string;
  max: number;
}) {
  const atLimit = value.length >= max;
  return (
    <p
      className={cn(
        "text-xs mt-1",
        atLimit ? "text-amber-600" : "text-zinc-500",
      )}
      role="status"
    >
      {atLimit ? `${max} character limit reached` : `Maximum ${max} characters`}
    </p>
  );
}
