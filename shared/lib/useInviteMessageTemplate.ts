import { useQuery } from "@tanstack/react-query";
import { shareUrlsGetInviteMessageTemplate } from "../client";
import { queryKeys } from "./queryKeys";

export function useInviteMessageTemplate(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  return useQuery({
    queryKey: queryKeys.inviteMessageTemplate(),
    queryFn: async () => {
      const response = await shareUrlsGetInviteMessageTemplate();
      if (response.error || !response.data) {
        throw response.error ?? new Error("Failed to load invitation message");
      }
      return response.data.template;
    },
    enabled,
  });
}
