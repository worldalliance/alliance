import {
  CreateOnetimeInviteDto,
  userCreateOnetimeInvite,
  userGetOnetimeInviteMemberStatsAdmin,
  userGetOnetimeInvitesAdmin,
  userListAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";
import { cn } from "@alliance/shared/styles/util";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CopyIcon from "@alliance/sharedweb/ui/icons/CopyIcon";
import List from "@alliance/sharedweb/ui/List";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";

const INVITES_PER_PAGE = 50;

const InvitesPage = () => {
  const queryClient = useQueryClient();

  const {
    data,
    page,
    setPage,
    isLoading,
    isError,
    isPlaceholderData,
    refetch,
  } = usePaginatedQuery({
    queryKey: (page) => queryKeys.onetimeInvitesAdmin(page, INVITES_PER_PAGE),
    queryFn: (page) =>
      userGetOnetimeInvitesAdmin({
        query: { page, limit: INVITES_PER_PAGE },
        throwOnError: true,
      }).then((response) => response.data),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) {
      return;
    }
    const formData = new FormData(event.target as HTMLFormElement);
    const body = {
      invitingUserId: selectedUser,
      invitee: formData.get("invitee")?.toString() ?? "",
    } satisfies CreateOnetimeInviteDto;
    const response = await userCreateOnetimeInvite({
      body,
    });
    if (response.data) {
      setSelectedUser(null);
      setPage(1);
      queryClient.invalidateQueries({
        queryKey: queryKeys.onetimeInvitesAdminAll(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.onetimeInviteMemberStatsAdmin(),
      });
    }
  };

  const [users, setUsers] = useState<UserSelectUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  useEffect(() => {
    userListAdmin().then((response) => {
      setUsers(response.data ?? []);
    });
  }, []);

  const {
    data: invitesPerMember = [],
    isError: isStatsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: queryKeys.onetimeInviteMemberStatsAdmin(),
    queryFn: () =>
      userGetOnetimeInviteMemberStatsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });

  const copyToClipboard = (text: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${text}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="flex flex-row w-full items-center justify-center pt-36">
      <div className="flex flex-col pb-10 items-stretch mx-2 w-2xl">
        <Card className="flex-1">
          <p className="font-bold">Create an invite</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="invitee"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Invitee
                </label>
                <input
                  type="text"
                  name="invitee"
                  placeholder="preferably a first name capitalized"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <UserSelect
                users={users}
                selectedUserIds={selectedUser ? [selectedUser] : []}
                onChange={(users) => setSelectedUser(users[0])}
                label="Inviting user"
                single={true}
              />
            </div>
            <div className="flex flex-row gap-2 justify-end">
              <Button color={ButtonColor.Black} type="submit">
                Create Invite
              </Button>
            </div>
          </form>
        </Card>
        {isStatsError && (
          <p className="mt-5 text-sm text-red-600">
            Failed to load invite stats.{" "}
            <button
              type="button"
              className="underline hover:text-red-700"
              onClick={() => refetchStats()}
            >
              Retry
            </button>
          </p>
        )}
        {invitesPerMember.length > 0 && (
          <details className="mt-5 rounded-lg border border-gray-200 bg-white">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold">
              Invites per Member
            </summary>
            <div className="px-5 pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-2 font-semibold">Member</th>
                    <th className="pb-2 text-right font-semibold">Sent</th>
                    <th className="pb-2 text-right font-semibold">Accepted</th>
                  </tr>
                </thead>
                <tbody>
                  {invitesPerMember.map((member) => (
                    <tr
                      key={member.invitingUser.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="py-2">
                        <div className="flex flex-row gap-2 items-center">
                          <AvatarProfile
                            size="small"
                            pfp={member.invitingUser.profilePicture}
                          />
                          <span>{member.invitingUser.displayName}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">{member.sent}</td>
                      <td className="py-2 text-right">{member.accepted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <div className="flex flex-row justify-between items-center my-5">
          <p className="font-bold">Past Invites</p>
          <Link
            to="/invites/graph"
            className="text-sm text-blue-600 hover:underline"
          >
            View Invite Graph
          </Link>
        </div>
        {isError && (
          <p className="text-sm text-red-600">
            Failed to load invites.{" "}
            <button
              type="button"
              className="underline hover:text-red-700"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </p>
        )}
        {isError && !data ? null : isLoading ? (
          <p className="text-sm text-zinc-500">Loading invites...</p>
        ) : (
          <List
            className={cn(
              "transition-opacity",
              isPlaceholderData && "opacity-60",
            )}
          >
            {(data?.items ?? []).map((invite) => (
              <div key={invite.id} className="p-4">
                <div className="flex flex-row gap-2 justify-between items-center">
                  <div className="flex flex-row gap-2">
                    <AvatarProfile
                      size="small"
                      pfp={invite.invitingUser?.profilePicture ?? null}
                    />
                    <p>
                      {invite.invitingUser?.displayName}{" "}
                      <span className="text-gray-500"> inviting </span>{" "}
                      {invite.invitedUserId ? (
                        <a
                          href={
                            getBaseUrl() + `/member/${invite.invitedUserId}`
                          }
                          className="underline"
                        >
                          {" "}
                          {invite.invitee}{" "}
                        </a>
                      ) : (
                        invite.invitee
                      )}
                    </p>
                  </div>
                  <div className="flex flex-row gap-3 items-center">
                    <p className="text-gray-500">{invite.code}</p>
                    {invite.status === "link_unused" ? (
                      <p className="text-green">Active</p>
                    ) : (
                      <p className="text-gray-500">used</p>
                    )}
                    <div
                      className="cursor-pointer active:scale-85 transition-all duration-100"
                      onClick={() => copyToClipboard(invite.code)}
                    >
                      <CopyIcon size="medium" fill="gray" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-2 items-center justify-between mt-1">
                  <div>
                    {invite.info && (
                      <p className="text-zinc-800 pt-4 text-sm">
                        {invite.info}
                      </p>
                    )}
                  </div>
                  {invite.createdAt && (
                    <p className="text-zinc-500 text-sm min-w-24">
                      {new Date(invite.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </List>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-zinc-500">{data.totalCount} total</p>
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitesPage;
