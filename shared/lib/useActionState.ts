import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { actionStore } from "./actionStore";

export function useActionState() {
  const store = actionStore(useQueryClient());
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
