/**
 * Whether the new-message screen holds input a restart would lose. The
 * recipient a `?to=` link picked doesn't count: the restart reopens the route
 * with its query, which picks it again. `linkUserId` is NaN without a link.
 */
export function newMessageHoldsInput(params: {
  selectedUserIds: number[];
  linkUserId: number;
  message: string;
  attachments: string[];
}): boolean {
  return (
    params.selectedUserIds.some((id) => id !== params.linkUserId) ||
    params.message !== "" ||
    params.attachments.length > 0
  );
}
