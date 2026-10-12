import {
  actionsCreateFormVariantAdmin,
  actionsDeleteFormVariantAdmin,
  actionsListFormVariantsAdmin,
  actionsUpdateFormVariantAdmin,
  type ActionFormVariantsListDto,
  type CreateActionFormVariantDto,
  type UpdateActionFormVariantDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useInvalidateFormsIndex } from "@alliance/shared/lib/useFormsAdmin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminRefusalMessage } from "./adminRefusal";

export const formVariantsLoadError = (error: unknown) =>
  adminRefusalMessage(error, "Failed to load variants.");

/** `select` picks what the caller reads, so a refetch that changes none of it
 * keeps the caller's data, and its effects, as they were. */
export function useFormVariantsAdmin<T>(
  actionId: number,
  select: (list: ActionFormVariantsListDto) => T,
) {
  const queryClient = useQueryClient();
  const invalidateFormsIndex = useInvalidateFormsIndex();
  const queryKey = queryKeys.formVariantsAdmin(actionId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const variants = useQuery({
    queryKey,
    queryFn: () =>
      actionsListFormVariantsAdmin({
        path: { id: actionId },
        throwOnError: true,
      }).then((res) => res.data),
    select,
  });

  /** Creates the drafts in order, stopping at the first that fails. */
  const publishVariants = useMutation({
    mutationFn: async (drafts: CreateActionFormVariantDto[]) => {
      let published = 0;
      for (const body of drafts) {
        // A request that never reaches the server still has to report the
        // drafts before it as published, or a retry creates them twice.
        const res = await actionsCreateFormVariantAdmin({
          path: { id: actionId },
          body,
        }).catch((error: unknown) => ({ error }));
        if (res.error) return { published, refusal: res.error };
        published++;
      }
      return { published, refusal: null };
    },
    // Each published variant clones its source form into a new form.
    onSettled: () => Promise.all([invalidate(), invalidateFormsIndex()]),
  });

  const updateVariant = useMutation({
    mutationFn: ({
      variantId,
      body,
    }: {
      variantId: number;
      body: UpdateActionFormVariantDto;
    }) =>
      actionsUpdateFormVariantAdmin({
        path: { variantId },
        body,
        throwOnError: true,
      }),
    onSuccess: invalidate,
  });

  const deleteVariant = useMutation({
    mutationFn: (variantId: number) =>
      actionsDeleteFormVariantAdmin({
        path: { variantId },
        throwOnError: true,
      }),
    // The cloned form outlives the variant, but nothing points at it now.
    onSuccess: () => Promise.all([invalidate(), invalidateFormsIndex()]),
  });

  return { variants, publishVariants, updateVariant, deleteVariant };
}
