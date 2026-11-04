import { createContext } from "react";

/** Set by a task card that shows the withdraw button itself: the flow hands it the button's action, or null when the member can't withdraw. */
export const CardWithdrawContext = createContext<
  ((openWithdraw: (() => void) | null) => void) | null
>(null);
