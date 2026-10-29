import { phoneSearchDigits, phoneSearchTerm } from "@alliance/common/phone";
import type { UserDto } from "@alliance/shared/client";

export const memberSearchMatcher = (rawQuery: string) => {
  const query = rawQuery.toLowerCase().trim();
  const phoneQuery = phoneSearchTerm(query);
  return (user: Pick<UserDto, "name" | "email" | "phoneNumber">) =>
    user.name.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query) ||
    (user.phoneNumber?.toLowerCase() ?? "").includes(query) ||
    (phoneQuery !== "" &&
      phoneSearchDigits(user.phoneNumber).includes(phoneQuery));
};
