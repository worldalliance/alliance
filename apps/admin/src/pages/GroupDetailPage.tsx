import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ConfirmMode, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useCallback, useState } from "react";
import { href, Link, useNavigate, useParams } from "react-router";
import GroupMembership from "../components/group-detail/GroupMembership";
import GroupSettingsForm from "../components/group-detail/GroupSettingsForm";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useCommunitiesAdmin,
  useDeleteCommunityAdmin,
} from "../lib/useCommunitiesAdmin";
import { useCommunityMemberInfoAdmin } from "../lib/useCommunityMemberInfoAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import { useUsersAdmin } from "../lib/useUsersAdmin";

const CommunityDetailPage: React.FC = () => {
  const { id } = useParams();
  const communityId = Number(id);
  const navigate = useNavigate();

  const communities = useCommunitiesAdmin();
  const community =
    communities.data?.find((candidate) => candidate.id === communityId) ?? null;
  const loading =
    !Number.isNaN(communityId) &&
    (communities.isPending ||
      (!community && communities.fetchStatus !== "idle"));
  const loadError = Number.isNaN(communityId)
    ? "Invalid community id."
    : communities.isError
      ? adminRefusalMessage(
          communities.error,
          "Unable to load community. Please try again.",
        )
      : null;
  const [error, setError] = useState<string | null>(null);
  const memberInfo = useCommunityMemberInfoAdmin(
    Number.isNaN(communityId) ? null : communityId,
  );
  const usersQuery = useUsersAdmin();
  const { confirm, success } = useToast();

  const refusalToast = useRefusalToast();
  const reportError = useCallback(
    (err: unknown, fallback: string) => {
      setError(adminRefusalMessage(err, fallback));
      refusalToast(err, fallback);
    },
    [refusalToast],
  );

  const {
    mutate: deleteCommunity,
    isPending: deleting,
    isSuccess: deleted,
  } = useDeleteCommunityAdmin({
    onSuccess: () => {
      if (community) success("Community deleted", community.name);
      navigate(href("/groups"));
    },
    onError: (err) =>
      reportError(err, "Unable to delete community. Please try again."),
  });

  const handleDelete = useCallback(async () => {
    if (!community) return;
    const confirmed = await confirm({
      title: `Delete ${community.name}?`,
      message:
        "All members and leaders will lose this community assignment. This action cannot be undone.",
      confirmLabel: "Delete community",
      cancelLabel: "Cancel",
      mode: ConfirmMode.Fullscreen,
    });
    if (!confirmed) {
      return;
    }
    setError(null);
    deleteCommunity(communityId);
  }, [community, communityId, confirm, deleteCommunity, setError]);

  if (deleted) return null;

  if (loading) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading community…</p>
      </div>
    );
  }

  const backToGroupsLink = (
    <Link to={href("/groups")} className="text-link hover:underline">
      ← Back to Groups
    </Link>
  );

  if (!community) {
    return (
      <div className="p-6 pt-20">
        {loadError ? (
          <p className="text-sm text-red-500">{loadError}</p>
        ) : (
          <p className="text-sm text-zinc-500">Community not found.</p>
        )}
        {backToGroupsLink}
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="p-6 pt-20 flex flex-col gap-6 max-w-5xl">
        <div className="flex flex-row items-center justify-between gap-3">
          <div>
            {backToGroupsLink}
            <h1 className="text-2xl font-semibold mt-2">{community.name}</h1>
            <p className="text-sm text-zinc-500">
              Manage group details, membership, and leadership.
            </p>
          </div>
          <Button
            type="button"
            color={ButtonColor.Red}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete group"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <GroupSettingsForm
          community={community}
          setError={setError}
          reportError={reportError}
        />

        <GroupMembership
          community={community}
          memberInfo={memberInfo}
          usersQuery={usersQuery}
          setError={setError}
          reportError={reportError}
        />
      </div>
    </div>
  );
};

export default CommunityDetailPage;
