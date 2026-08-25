import { pickForCount, withCount } from "@alliance/common/plural";
import { actionsGetUnwelcomedSignedContractMembersAdmin } from "@alliance/shared/client";
import type { UnwelcomedSignedContractMemberDto } from "@alliance/shared/client/types.gen";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

type WelcomeQueueFilter = "all" | "staff-liked";

const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const frontendActivityCommentsUrl = (
  entry: UnwelcomedSignedContractMemberDto,
): string =>
  `${getBaseUrl()}/actions/${entry.actionId}/activity/${entry.activityId}#comments`;

const WelcomeQueuePage: React.FC = () => {
  const [members, setMembers] = useState<UnwelcomedSignedContractMemberDto[]>(
    [],
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WelcomeQueueFilter>("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    actionsGetUnwelcomedSignedContractMembersAdmin()
      .then((response) => {
        setMembers(response.data ?? []);
      })
      .catch((err: unknown) => {
        console.error("Failed to load welcome queue", err);
        setError("Unable to load members who need welcomes.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const staffLikedCount = useMemo(
    () => members.filter((member) => member.staffLikeCount > 0).length,
    [members],
  );

  const displayedMembers = useMemo(
    () =>
      members
        .filter((member) => {
          switch (filter) {
            case "all":
              return true;
            case "staff-liked":
              return member.staffLikeCount > 0;
            default:
              filter satisfies never;
              return true;
          }
        })
        .sort(
          (a, b) =>
            new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime(),
        ),
    [filter, members],
  );

  return (
    <div className="p-5 space-y-4">
      <title>Welcome Queue - Admin</title>
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Welcome Queue</h1>
        <p className="text-sm text-zinc-600 mt-1 max-w-3xl">
          We welcome every user by leaving a comment on their signed contract
          action. This list shows signed members whose contract completion has
          not received a staff comment yet.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="border border-zinc-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-800">
            {loading
              ? "Loading members..."
              : `${withCount(displayedMembers.length, "member")} ${pickForCount(displayedMembers.length, "needs", "need")} a welcome`}
          </p>
          <div className="flex rounded-md border border-zinc-300 bg-white overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 ${
                filter === "all"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              All ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("staff-liked")}
              className={`px-3 py-1.5 border-l border-zinc-300 ${
                filter === "staff-liked"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              Staff liked ({staffLikedCount})
            </button>
          </div>
        </div>

        {!loading && displayedMembers.length === 0 && !error ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No signed contract completions match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-600">
                    Member
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-600">
                    Signed
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-600">
                    Completed
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-600">
                    Staff Likes
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-600">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {displayedMembers.map((entry) => (
                  <tr key={entry.activityId} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AvatarProfile pfp={entry.user.profilePicture} />
                        <div>
                          <Link
                            to={`/member/${entry.user.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {entry.user.displayName}
                          </Link>
                          <p className="text-xs text-zinc-500">
                            ID: {entry.user.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {formatDate(entry.signedAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {formatDate(entry.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {entry.staffLikeCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          to={`/actions/${entry.actionId}`}
                          className="text-blue-600 hover:underline"
                        >
                          Contract action
                        </Link>
                        <a
                          href={frontendActivityCommentsUrl(entry)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Leave welcome comment
                        </a>
                        <span className="text-zinc-500">
                          Activity #{entry.activityId}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td className="px-4 py-8 text-sm text-zinc-500" colSpan={5}>
                      Loading members...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeQueuePage;
