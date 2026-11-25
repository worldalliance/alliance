import { createContext } from "react";

/** Where a task card shows the flow's withdraw menu: undefined outside a card, null until the slot mounts. */
export const CardMenuSlotContext = createContext<
  HTMLElement | null | undefined
>(undefined);
