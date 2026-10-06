import { createContext, useContext } from "react";

type DerivedWrite = (write: () => void) => void;

export const DerivedWriteContext = createContext<DerivedWrite>((write) =>
  write(),
);

/**
 * Runs a write that settles a value the editor derives, such as a default or
 * a cached copy, rather than one the admin chose. It joins the current undo
 * step, so undoing past it can't re-derive it into a new step.
 */
export const useDerivedWrite = () => useContext(DerivedWriteContext);
