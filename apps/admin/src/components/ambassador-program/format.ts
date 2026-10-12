import { UserDto } from "@alliance/shared/client";

export const memberDisplayName = (
  user: Pick<UserDto, "id" | "name" | "email">,
) => user.name?.trim() || user.email || `User #${user.id}`;

export const formatGoalDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

export const numberLabel = (value: number) => value.toLocaleString();
