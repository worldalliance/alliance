import { withCount } from "@alliance/common/plural";
import { clusterListAdmin, clusterUpdateAdmin } from "@alliance/shared/client";
import type { ClusterAdminDto } from "@alliance/shared/client/types.gen";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { CardStyle } from "@alliance/shared/styles/card";
import { memberProfileUrl } from "@alliance/sharedweb/lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";

function useClustersAdmin() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.clustersAdmin();
  const list = useQuery({
    queryKey,
    queryFn: () => clusterListAdmin({ throwOnError: true }).then((r) => r.data),
  });

  const replaceCluster = async (updated: ClusterAdminDto) => {
    // A refetch in flight would land the old name back over the rename.
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<ClusterAdminDto[]>(queryKey, (prev) =>
      prev?.map((c) => (c.id === updated.id ? updated : c)),
    );
  };

  return { list, replaceCluster };
}

const ClustersPage: React.FC = () => {
  const { list, replaceCluster } = useClustersAdmin();
  const clusters = useMemo(() => list.data ?? [], [list.data]);
  const error = list.isError
    ? thrownRefusalMessage({
        error: list.error,
        fallback: "Unable to load clusters.",
        sessionExpired: sessionExpiredMessage,
      })
    : null;
  const { success, error: toastError } = useToast();

  const totalMembers = clusters.reduce((acc, c) => acc + c.members.length, 0);

  const handleExportClustermates = useCallback(async () => {
    const escapeMdLabel = (s: string) => s.replace(/[\\[\]*_`~<>]/g, "\\$&");
    const payload: Record<string, string> = {};
    for (const cluster of clusters) {
      for (const member of cluster.members) {
        const others = cluster.members
          .filter((m) => m.id !== member.id)
          .sort((a, b) => a.id - b.id);
        if (others.length === 0) {
          payload[String(member.id)] =
            `You are the only member of your introduction group (${cluster.displayName}).`;
          continue;
        }
        const list = others
          .map(
            (m) =>
              `- [${escapeMdLabel(m.displayName)}](${memberProfileUrl(m.id)})`,
          )
          .join("\n");
        payload[String(member.id)] =
          `The other members of your introduction group (${cluster.displayName}) are:\n\n${list}`;
      }
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      const userCount = Object.keys(payload).length;
      success(
        `Copied clustermates for ${withCount(userCount, "user")} to clipboard.`,
      );
    } catch (err) {
      console.error("Failed to copy clustermates", err);
      toastError("Could not copy to clipboard.");
    }
  }, [clusters, success, toastError]);

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      <title>Clusters - Admin</title>
      <div className="w-full max-w-5xl flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Clusters</h2>
            <p className="text-sm text-zinc-500">
              Friend-disjoint groupings of signed members, used for matching.
            </p>
          </div>
          <div className="flex flex-row items-center gap-2">
            <Button
              color={ButtonColor.White}
              onClick={handleExportClustermates}
              disabled={clusters.length === 0}
              title="Copy a JSON object mapping each user id to a markdown list of their clustermates"
            >
              Export clustermates
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {list.data && (
          <Card style={CardStyle.White}>
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-zinc-700">
                {withCount(clusters.length, "cluster")}
              </p>
              <p className="text-zinc-500">
                {withCount(totalMembers, "member")} placed
              </p>
            </div>
          </Card>
        )}

        {list.isPending ? (
          <p className="text-sm text-zinc-500">Loading clusters…</p>
        ) : !list.data ? null : clusters.length === 0 ? (
          <p className="text-sm text-zinc-500">No clusters yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {clusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                onRenamed={replaceCluster}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

type ClusterCardProps = {
  cluster: ClusterAdminDto;
  onRenamed: (cluster: ClusterAdminDto) => Promise<void>;
};

const ClusterCard: React.FC<ClusterCardProps> = ({ cluster, onRenamed }) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [draftName, setDraftName] = useState<string>(cluster.displayName);
  const { error: toastError } = useToast();

  const { mutate: rename, isPending: saving } = useMutation({
    mutationFn: (displayName: string) =>
      clusterUpdateAdmin({
        path: { id: cluster.id },
        body: { displayName },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: async (updated) => {
      await onRenamed(updated);
      setEditing(false);
    },
    onError: (err) => {
      console.error("Failed to rename cluster", err);
      toastError(
        thrownRefusalMessage({
          error: err,
          fallback: "Could not rename cluster.",
          sessionExpired: sessionExpiredMessage,
        }),
      );
    },
  });

  const startEdit = () => {
    setDraftName(cluster.displayName);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftName(cluster.displayName);
  };

  const save = () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === cluster.displayName) {
      cancelEdit();
      return;
    }
    rename(trimmed);
  };

  return (
    <Card style={CardStyle.White}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between gap-3">
          {editing ? (
            <div className="flex flex-row items-center gap-2 flex-1">
              <input
                type="text"
                autoFocus
                className="border border-zinc-300 rounded px-2 py-1 text-base font-semibold flex-1 max-w-sm"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  else if (e.key === "Escape") cancelEdit();
                }}
                disabled={saving}
              />
              <Button
                color={ButtonColor.Blue}
                onClick={save}
                disabled={saving}
                className="!px-3 !py-1 text-sm"
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                color={ButtonColor.Transparent}
                onClick={cancelEdit}
                disabled={saving}
                className="!px-3 !py-1 text-sm"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-row items-center gap-2">
              <h3 className="text-base font-semibold">{cluster.displayName}</h3>
              <button
                type="button"
                onClick={startEdit}
                className="text-zinc-400 hover:text-zinc-700"
                aria-label="Rename cluster"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="text-sm text-zinc-500">
            {withCount(cluster.members.length, "member")}
          </p>
        </div>

        {cluster.members.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No members</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cluster.members.map((m) => (
              <Link
                key={m.id}
                to={`/member/${m.id}`}
                className="flex flex-row items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 pl-1 pr-3 py-1 text-sm"
              >
                <AvatarProfile pfp={m.profilePicture ?? null} size="small" />
                <span>{m.displayName}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ClustersPage;
