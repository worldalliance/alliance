import type { CustomActionStat } from "../client/types.gen";

const tracked: Record<CustomActionStat, boolean> = {
  none: false,
  users_invited: true,
};

export const tracksCustomStat = (type: CustomActionStat | undefined) =>
  !!type && tracked[type];
