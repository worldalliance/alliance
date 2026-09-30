import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback } from "react";
import { adminRefusalMessage } from "./adminRefusal";

export function useRefusalToast(): (error: unknown, fallback: string) => void {
  const { error: toastError } = useToast();
  return useCallback(
    (error, fallback) => {
      console.error(fallback, error);
      toastError(adminRefusalMessage(error, fallback));
    },
    [toastError],
  );
}
