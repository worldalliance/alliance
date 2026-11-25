import { createContext, type ReactNode } from "react";

/**
 * What a form host renders under a phone question that fills the profile, once
 * it holds a whole number. Null, the default, renders the plain field.
 */
export const PhoneConfirmSlot = createContext<
  ((phoneNumber: string) => ReactNode) | null
>(null);
