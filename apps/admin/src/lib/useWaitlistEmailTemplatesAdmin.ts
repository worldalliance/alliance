import {
  type SaveWaitlistEmailTemplateDto,
  waitlistEmailAdminCreateTemplateAdmin,
  waitlistEmailAdminDeleteTemplateAdmin,
  waitlistEmailAdminFindTemplatesAdmin,
  waitlistEmailAdminUpdateTemplateAdmin,
  type WaitlistEmailTemplateDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useListCache } from "./useListCache";

export function useWaitlistEmailTemplatesAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistEmailTemplatesAdmin(),
    queryFn: () =>
      waitlistEmailAdminFindTemplatesAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

const useTemplatesCache = () =>
  useListCache<WaitlistEmailTemplateDto>(
    queryKeys.waitlistEmailTemplatesAdmin(),
  );

export function useSaveWaitlistEmailTemplateAdmin(params: {
  onSuccess: (template: WaitlistEmailTemplateDto, id: number | null) => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onSuccess, onError, onSettled } = params;
  const cache = useTemplatesCache();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number | null;
      body: SaveWaitlistEmailTemplateDto;
    }) =>
      (id === null
        ? waitlistEmailAdminCreateTemplateAdmin({ body, throwOnError: true })
        : waitlistEmailAdminUpdateTemplateAdmin({
            path: { id },
            body,
            throwOnError: true,
          })
      ).then((r) => r.data),
    onSuccess: (template, { id }) => {
      cache.update((old) =>
        id === null
          ? [...old, template]
          : old.map((saved) => (saved.id === id ? template : saved)),
      );
      onSuccess(template, id);
    },
    onError,
    onSettled: async () => {
      onSettled();
      await cache.invalidate();
    },
  });
}

export function useDeleteWaitlistEmailTemplateAdmin(params: {
  onSuccess: (template: WaitlistEmailTemplateDto) => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onSuccess, onError, onSettled } = params;
  const cache = useTemplatesCache();
  return useMutation({
    mutationFn: (template: WaitlistEmailTemplateDto) =>
      waitlistEmailAdminDeleteTemplateAdmin({
        path: { id: template.id },
        throwOnError: true,
      }).then(() => template),
    onSuccess: (template) => {
      cache.update((old) => old.filter((saved) => saved.id !== template.id));
      onSuccess(template);
    },
    onError,
    onSettled: async () => {
      onSettled();
      await cache.invalidate();
    },
  });
}
