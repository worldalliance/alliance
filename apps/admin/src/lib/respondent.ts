import type { FormResponseDto, ProfileDto } from "@alliance/shared/client";

export function respondentName(params: {
  response: Pick<FormResponseDto, "user" | "sid">;
  sidsToUserMap: Record<string, ProfileDto>;
}): string {
  const { response, sidsToUserMap } = params;
  const inviter = sidsToUserMap[response.sid ?? ""];
  return (
    response.user?.name ??
    (inviter ? `anonymous invited by ${inviter.displayName}` : "anonymous")
  );
}
