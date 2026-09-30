import { waitlistRememberInvite } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** The server keeps the code only while it can start a signup. */
export function useRememberInvite(code: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!code) return;
    void waitlistRememberInvite({ body: { code } }).then(() =>
      queryClient.invalidateQueries({ queryKey: queryKeys.waitlistBrowser() }),
    );
  }, [code, queryClient]);
}
