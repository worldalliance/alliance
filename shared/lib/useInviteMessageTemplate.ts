import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  shareUrlsGetInviteMessageTemplate,
  shareUrlsUpdateInviteMessageTemplate,
} from "../client";
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

export function useUpdateInviteMessageTemplate(params: {
  onSuccess: () => void;
  onError: () => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: string) => {
      const response = await shareUrlsUpdateInviteMessageTemplate({
        body: { template },
      });
      if (response.error || !response.data) {
        throw response.error ?? new Error("Failed to save invitation message");
      }
      return response.data.template;
    },
    onSuccess: (template) => {
      queryClient.setQueryData(queryKeys.inviteMessageTemplate(), template);
      params.onSuccess();
    },
    onError: params.onError,
  });
}
