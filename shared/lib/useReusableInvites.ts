import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShareUrlMineDto,
  shareUrlsCreateInviteDuplicate,
  shareUrlsDeleteMyInvite,
  shareUrlsFindMyInvites,
  shareUrlsUpdateMyInvite,
} from "../client";
import { queryKeys } from "./queryKeys";

const QUERY_KEY = queryKeys.myReusableInvites();

/**
 * Single source of truth for the current user's reusable invite links.
 * Owns the query plus create/edit/delete mutations and their cache updates;
 * callers supply only presentation (and attach `onError` per `mutateAsync`
 * call for platform-specific error surfaces).
 */
export function useReusableInvites(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const {
    data: links = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await shareUrlsFindMyInvites();
      if (res.error || !res.data) {
        throw res.error ?? new Error("Failed to load reusable invites");
      }
      return res.data;
    },
    enabled,
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      label: string;
      communityId: number | null;
    }) => {
      const { label, communityId } = params;
      const trimmed = label.trim();
      const res = await shareUrlsCreateInviteDuplicate({
        body: {
          ...(trimmed && { label: trimmed }),
          communityId,
        },
      });
      if (res.error || !res.data) {
        throw res.error ?? new Error("Failed to create reusable invite");
      }
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ambassadorInviteDashboard(),
      });
    },
  });

  const updateMutation = useMutation({
    /** Each field is left alone when omitted; `communityId: null` means any open group. */
    mutationFn: async (vars: {
      id: string;
      label?: string;
      communityId?: number | null;
    }) => {
      const { id, ...body } = vars;
      const res = await shareUrlsUpdateMyInvite({ path: { id }, body });
      if (res.error || !res.data) {
        throw res.error ?? new Error("Failed to update invite link");
      }
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ShareUrlMineDto[]>(QUERY_KEY, (prev) =>
        prev?.map((link) => (link.id === updated.id ? updated : link)),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await shareUrlsDeleteMyInvite({ path: { id } });
      if (res.error) {
        throw res.error;
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ShareUrlMineDto[]>(QUERY_KEY, (prev) =>
        prev?.filter((link) => link.id !== id),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ambassadorInviteDashboard(),
      });
    },
  });

  return {
    links,
    isPending,
    isError,
    isCreating: createMutation.isPending,
    createInvite: createMutation.mutateAsync,
    updateInvite: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteInvite: deleteMutation.mutateAsync,
  };
}
