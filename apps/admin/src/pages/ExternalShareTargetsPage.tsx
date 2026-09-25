import { appendQueryParam, isValidHttpUrl } from "@alliance/common/url";
import {
  externalShareTargetsCreateAdmin,
  externalShareTargetsFindAllAdmin,
  externalShareTargetsRemoveAdmin,
  externalShareTargetsUpdateAdmin,
} from "@alliance/shared/client";
import type {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
} from "@alliance/shared/client/types.gen";
import {
  thrownRefusalMessage,
  thrownStatus,
} from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { sessionExpiredMessage } from "../lib/sessionExpired";

const INITIAL_NEW_TARGET: CreateExternalShareTargetDto = {
  name: "",
  url: "",
  paramName: "",
};

const withoutId = (ids: Set<number>, id: number) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

const ExternalShareTargetsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: queryKeys.externalShareTargetsAdmin(),
    queryFn: () =>
      externalShareTargetsFindAllAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
  });
  const targets = list.data ?? [];
  const loadError = list.isError
    ? thrownRefusalMessage({
        error: list.error,
        fallback: "Failed to load share targets.",
        sessionExpired: sessionExpiredMessage,
      })
    : null;
  const [error, setError] = useState<string | null>(null);
  const [newTarget, setNewTarget] =
    useState<CreateExternalShareTargetDto>(INITIAL_NEW_TARGET);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(() => new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(() => new Set());

  const setTargets = async (
    update: (prev: ExternalShareTargetDto[]) => ExternalShareTargetDto[],
  ) => {
    const queryKey = queryKeys.externalShareTargetsAdmin();
    // A fetch started before the write would land the old list over it.
    await queryClient.cancelQueries({ queryKey });
    // With no list to patch (the first load was cancelled or failed), a fresh
    // fetch picks up the write.
    if (!queryClient.getQueryData(queryKey)) {
      await queryClient.refetchQueries({ queryKey });
      return;
    }
    queryClient.setQueryData<ExternalShareTargetDto[]>(
      queryKey,
      (prev) => prev && update(prev),
    );
  };

  const reportError = (err: unknown, fallback: string) => {
    console.error(fallback, err);
    setError(
      thrownRefusalMessage({
        error: err,
        fallback,
        sessionExpired: sessionExpiredMessage,
      }),
    );
  };

  const createTarget = useMutation({
    mutationFn: (body: CreateExternalShareTargetDto) =>
      externalShareTargetsCreateAdmin({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: async (created) => {
      setNewTarget(INITIAL_NEW_TARGET);
      // A refetch that landed before this response may already list it.
      await setTargets((prev) => [
        created,
        ...prev.filter((t) => t.id !== created.id),
      ]);
    },
    onError: (err) => reportError(err, "Unable to create share target."),
  });

  const updateTarget = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: number;
      values: CreateExternalShareTargetDto;
    }) =>
      externalShareTargetsUpdateAdmin({
        path: { id },
        body: {
          name: values.name.trim(),
          url: values.url.trim(),
          paramName: values.paramName.trim(),
        },
        throwOnError: true,
      }).then((r) => r.data),
    onMutate: ({ id }) => {
      setUpdatingIds((prev) => new Set(prev).add(id));
    },
    onSettled: (_data, _err, { id }) => {
      setUpdatingIds((prev) => withoutId(prev, id));
    },
    onSuccess: (updated) =>
      setTargets((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      ),
    onError: (err) => reportError(err, "Unable to update share target."),
  });

  const deleteTarget = useMutation({
    mutationFn: (id: number) =>
      externalShareTargetsRemoveAdmin({
        path: { id },
        throwOnError: true,
      }).then(
        () => undefined,
        (err: unknown) => {
          // Already deleted elsewhere: the card goes, same as a delete that worked.
          if (thrownStatus(err) !== 404) throw err;
        },
      ),
    onMutate: (id) => {
      setDeletingIds((prev) => new Set(prev).add(id));
    },
    onSettled: (_data, _err, id) => {
      setDeletingIds((prev) => withoutId(prev, id));
    },
    onSuccess: (_data, id) =>
      setTargets((prev) => prev.filter((t) => t.id !== id)),
    onError: (err) => reportError(err, "Unable to delete share target."),
  });

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newTarget.name.trim();
    const url = newTarget.url.trim();
    const paramName = newTarget.paramName.trim();
    if (!name || !url || !paramName) {
      setError("Name, URL, and parameter name are all required.");
      return;
    }
    if (!isValidHttpUrl(url)) {
      setError("Enter a valid http:// or https:// URL.");
      return;
    }
    setError(null);
    createTarget.mutate({ name, url, paramName });
  };

  const handleUpdate = (id: number, values: CreateExternalShareTargetDto) => {
    setError(null);
    return updateTarget.mutateAsync({ id, values }).then(
      () => true,
      () => false,
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (
      !window.confirm(`Delete share target "${name}"? This cannot be undone.`)
    ) {
      return;
    }
    setError(null);
    deleteTarget.mutate(id);
  };

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      <title>Share Targets - Admin</title>
      {error && (
        <div className="w-full max-w-4xl">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="w-full max-w-4xl flex flex-col gap-3">
        <h2 className="text-2xl font-semibold mb-2">External share targets</h2>
        <p className="text-sm text-zinc-500">
          Allowed off-site URLs that the &ldquo;Share URL&rdquo; form component
          can link to. Each user gets a unique share code per target.
        </p>
        {list.isPending ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            {loadError && <p className="text-sm text-red-500">{loadError}</p>}
            {targets.length
              ? targets.map((target) => (
                  <TargetCard
                    key={target.id}
                    target={target}
                    onSave={(values) => handleUpdate(target.id, values)}
                    onDelete={() => handleDelete(target.id, target.name)}
                    isUpdating={updatingIds.has(target.id)}
                    isDeleting={deletingIds.has(target.id)}
                  />
                ))
              : list.data && (
                  <p className="text-sm text-zinc-500">No share targets yet.</p>
                )}
          </>
        )}
      </div>

      <Card className="w-full max-w-4xl" style={CardStyle.White}>
        <p className="font-bold mb-4">Create share target</p>
        <form className="flex flex-col gap-3" onSubmit={handleCreate}>
          <FormField label="Name">
            <input
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm"
              value={newTarget.name}
              onChange={(event) => {
                setError(null);
                setNewTarget((prev) => ({ ...prev, name: event.target.value }));
              }}
              placeholder="Internal label, e.g. Partner X signup"
            />
          </FormField>
          <FormField label="URL">
            <input
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm font-mono"
              value={newTarget.url}
              onChange={(event) => {
                setError(null);
                setNewTarget((prev) => ({ ...prev, url: event.target.value }));
              }}
              placeholder="https://example.com/route"
            />
            {newTarget.url.trim() !== "" && !isValidHttpUrl(newTarget.url) && (
              <p className="text-xs text-red-500">
                Enter a valid http:// or https:// URL.
              </p>
            )}
          </FormField>
          <FormField label="Parameter name">
            <input
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm font-mono"
              value={newTarget.paramName}
              onChange={(event) => {
                setError(null);
                setNewTarget((prev) => ({
                  ...prev,
                  paramName: event.target.value,
                }));
              }}
              placeholder="code"
            />
          </FormField>
          <Button
            type="submit"
            color={ButtonColor.Blue}
            className="self-start"
            disabled={
              createTarget.isPending ||
              !newTarget.name.trim() ||
              !newTarget.paramName.trim() ||
              !isValidHttpUrl(newTarget.url)
            }
          >
            {createTarget.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-zinc-700">{label}</label>
    {children}
  </div>
);

type TargetCardProps = {
  target: ExternalShareTargetDto;
  onSave: (values: CreateExternalShareTargetDto) => Promise<boolean> | boolean;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
};

const TargetCard: React.FC<TargetCardProps> = ({
  target,
  onSave,
  onDelete,
  isUpdating,
  isDeleting,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<CreateExternalShareTargetDto>({
    name: target.name,
    url: target.url,
    paramName: target.paramName,
  });

  useEffect(() => {
    setValues({
      name: target.name,
      url: target.url,
      paramName: target.paramName,
    });
  }, [target]);

  const trimmedParamName = values.paramName.trim();
  const previewUrl =
    isValidHttpUrl(values.url) && trimmedParamName
      ? appendQueryParam(values.url, trimmedParamName, "share-12345")
      : null;

  const canSave =
    !!values.name.trim() && !!trimmedParamName && isValidHttpUrl(values.url);

  const handleSave = async () => {
    if (!canSave) return;
    const urlChanged = values.url.trim() !== target.url;
    const paramNameChanged = trimmedParamName !== target.paramName;
    if (urlChanged || paramNameChanged) {
      const confirmed = window.confirm(
        "Changing the URL or parameter name will not update share links that users have already copied or posted — those will keep pointing to the old destination. Continue?",
      );
      if (!confirmed) return;
    }
    const ok = await onSave(values);
    if (ok) setIsEditing(false);
  };

  return (
    <Card className="w-full" style={CardStyle.White}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-row items-center gap-2">
              <h3 className="font-semibold">{target.name}</h3>
              <span className="text-xs text-zinc-500">id {target.id}</span>
            </div>
            {previewUrl && (
              <p className="text-sm text-zinc-600 font-mono break-all">
                {previewUrl}
              </p>
            )}
          </div>
          <div className="flex flex-row gap-2 shrink-0">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  color={ButtonColor.Light}
                  onClick={() => setIsEditing(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  color={ButtonColor.Blue}
                  onClick={handleSave}
                  disabled={isUpdating || !canSave}
                >
                  {isUpdating ? "Saving…" : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  color={ButtonColor.Light}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  color={ButtonColor.Red}
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </Button>
              </>
            )}
          </div>
        </div>
        {isEditing && (
          <div className="flex flex-col gap-3">
            <FormField label="Name">
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 text-sm"
                value={values.name}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormField>
            <FormField label="URL">
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 text-sm font-mono"
                value={values.url}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, url: event.target.value }))
                }
              />
              {values.url.trim() !== "" && !isValidHttpUrl(values.url) && (
                <p className="text-xs text-red-500">
                  Enter a valid http:// or https:// URL.
                </p>
              )}
            </FormField>
            <FormField label="Parameter name">
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 text-sm font-mono"
                value={values.paramName}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    paramName: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ExternalShareTargetsPage;
