import {
  shareUrlsCreateDuplicateAdmin,
  shareUrlsDeleteAdmin,
  shareUrlsFindForCampaignAdmin,
  shareUrlsFindForUserAdmin,
  shareUrlsUpdateLabelAdmin,
  type CreateDuplicateShareLinkDto,
  type ShareUrlAdminDto,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { adminRefusalMessage } from "./adminRefusal";
import { usePatchAnyQueryData } from "./usePatchQueryData";

export type ShareLinkOwner =
  | { type: "user"; id: number }
  | { type: "campaign"; id: number };

/** The owner identity to send to endpoints keyed by user/campaign id. */
const ownerColumns = (
  owner: ShareLinkOwner,
): { userId?: number; campaignId?: number } => {
  switch (owner.type) {
    case "user":
      return { userId: owner.id };
    case "campaign":
      return { campaignId: owner.id };
    default:
      throw new Error(`unknown owner type: ${owner satisfies never}`);
  }
};

const loadShareLinks = (owner: ShareLinkOwner) => {
  switch (owner.type) {
    case "user":
      return shareUrlsFindForUserAdmin({
        path: { userId: owner.id },
        throwOnError: true,
      }).then((r) => r.data);
    case "campaign":
      return shareUrlsFindForCampaignAdmin({
        path: { campaignId: owner.id },
        throwOnError: true,
      }).then((r) => r.data);
    default:
      throw new Error(`unknown owner type: ${owner satisfies never}`);
  }
};

const shareLinksQuery = (owner: ShareLinkOwner | null) =>
  queryOptions({
    queryKey: queryKeys.shareLinksAdmin(owner),
    queryFn: owner ? () => loadShareLinks(owner) : skipToken,
  });

export const shareLinksLoadError = (error: unknown) =>
  adminRefusalMessage(error, "Failed to load share links.");

/** Each write names its owner, so it patches that owner's list even after the
 * page has moved on to another. */
export function useShareLinksAdmin(owner: ShareLinkOwner | null) {
  const links = useQuery(shareLinksQuery(owner));
  const patch = usePatchAnyQueryData();
  const patchLinks = (
    linksOwner: ShareLinkOwner,
    update: (prev: ShareUrlAdminDto[]) => ShareUrlAdminDto[],
  ) => patch(shareLinksQuery(linksOwner).queryKey, update);

  const updateLabel = useMutation({
    mutationFn: ({
      id,
      label,
    }: {
      owner: ShareLinkOwner;
      id: string;
      label: string;
    }) =>
      shareUrlsUpdateLabelAdmin({
        path: { id },
        body: { label },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated, variables) =>
      patchLinks(variables.owner, (prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      ),
  });

  const remove = useMutation({
    mutationFn: ({ id }: { owner: ShareLinkOwner; id: string }) =>
      shareUrlsDeleteAdmin({ path: { id }, throwOnError: true }).then(
        () => undefined,
        rethrowUnlessNotFound,
      ),
    onSuccess: (_data, variables) =>
      patchLinks(variables.owner, (prev) =>
        prev.filter((r) => r.id !== variables.id),
      ),
  });

  const createDuplicate = useMutation({
    mutationFn: ({
      owner: linksOwner,
      target,
    }: {
      owner: ShareLinkOwner;
      target: Omit<CreateDuplicateShareLinkDto, "userId" | "campaignId">;
    }) =>
      shareUrlsCreateDuplicateAdmin({
        body: { ...ownerColumns(linksOwner), ...target },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (created, variables) =>
      // A refetch that landed before this response may already list it.
      patchLinks(variables.owner, (prev) => [
        created,
        ...prev.filter((r) => r.id !== created.id),
      ]),
  });

  return { links, updateLabel, remove, createDuplicate };
}
