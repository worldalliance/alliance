import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AddUserToTagDto,
  CreateTagDto,
  userAddUserToTagAdmin,
  userCreateTagAdmin,
  userDeleteTagAdmin,
  userGetTagsAdmin,
  userRemoveUserFromTagAdmin,
  userUpdateTagAdmin,
} from "../client";
import { queryKeys } from "./queryKeys";

const QUERY_KEY = queryKeys.tagsAdmin();

/**
 * Single source of truth for tags — wraps `userGetTagsAdmin` and the
 * create/update/delete/membership endpoints in react-query, sharing one cache
 * key that every mutation invalidates.
 */
export function useTagsAdmin(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const {
    data: tags = [],
    // a disabled query is permanently pending
    isLoading,
    isError,
    isLoadingError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      userGetTagsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createTag = useMutation({
    mutationFn: (body: CreateTagDto) =>
      userCreateTagAdmin({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const updateTag = useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: CreateTagDto }) =>
      userUpdateTagAdmin({ path: { tagId }, body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });

  const deleteTag = useMutation({
    mutationFn: (tagId: string) =>
      userDeleteTagAdmin({ path: { tagId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });

  const addUserToTag = useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: AddUserToTagDto }) =>
      userAddUserToTagAdmin({ path: { tagId }, body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidate,
  });

  const removeUserFromTag = useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: AddUserToTagDto }) =>
      userRemoveUserFromTagAdmin({
        path: { tagId },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return {
    tags,
    isLoading,
    isError,
    isLoadingError,
    refetch,
    createTag,
    updateTag,
    deleteTag,
    addUserToTag,
    removeUserFromTag,
  };
}
