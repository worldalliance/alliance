import { forCount } from "@alliance/common/plural";
import {
  actionsAllGeneralUpdatesAdmin,
  GeneralUpdateAdminDto,
} from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { useNavigate } from "react-router";
import GeneralUpdateCard from "../components/GeneralUpdateCard";
import { sessionExpiredMessage } from "../lib/sessionExpired";

function useGeneralUpdatesAdmin() {
  return useQuery({
    queryKey: queryKeys.generalUpdatesAdmin(),
    queryFn: () =>
      actionsAllGeneralUpdatesAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

const GeneralUpdatesPage: React.FC = () => {
  const list = useGeneralUpdatesAdmin();
  const updates = useMemo(() => list.data ?? [], [list.data]);
  const error = list.isError
    ? thrownRefusalMessage({
        error: list.error,
        fallback: "Failed to load general updates",
        sessionExpired: sessionExpiredMessage,
      })
    : null;
  const navigate = useNavigate();

  const { draftUpdates, activeUpdates, scheduledUpdates, expiredUpdates } =
    useMemo(() => {
      const now = new Date();
      const draftUpdates: GeneralUpdateAdminDto[] = [];
      const activeUpdates: GeneralUpdateAdminDto[] = [];
      const scheduledUpdates: GeneralUpdateAdminDto[] = [];
      const expiredUpdates: GeneralUpdateAdminDto[] = [];

      updates.forEach((u) => {
        if (!u.startDate) {
          draftUpdates.push(u);
        } else if (new Date(u.startDate) > now) {
          scheduledUpdates.push(u);
        } else if (!u.endDate || new Date(u.endDate) > now) {
          activeUpdates.push(u);
        } else {
          expiredUpdates.push(u);
        }
      });

      return { draftUpdates, activeUpdates, scheduledUpdates, expiredUpdates };
    }, [updates]);

  if (list.isPending) {
    return <p className="p-5">Loading general updates...</p>;
  }

  if (error && !list.data) {
    return <p className="p-5 text-red-500">{error}</p>;
  }

  const groups = [
    { label: "Draft", items: draftUpdates },
    { label: "Active", items: activeUpdates },
    { label: "Scheduled", items: scheduledUpdates },
    { label: "Expired", items: expiredUpdates },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4 p-5">
      <title>General Updates - Admin</title>
      <div className="flex items-center gap-x-2">
        <p className="font-bold text-lg">General Updates</p>
        <Button
          onClick={() => navigate("/general-updates/new")}
          className="hover:bg-green-2 text-white !px-3 !py-1 rounded-md text-sm"
          color={ButtonColor.Green}
        >
          New General Update
        </Button>
      </div>
      <p className="text-sm text-zinc-500">
        {updates.length} total {forCount(updates.length, "update")}
      </p>

      {error && <p className="text-red-500">{error}</p>}

      {updates.length === 0 ? (
        <p className="text-zinc-500">No general updates found.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-x-2 mb-2">
                <div className="h-px bg-zinc-300 flex-1" />
                <p className="text-xs font-bold uppercase text-zinc-700">
                  {group.label}
                </p>
                <div className="h-px bg-zinc-300 flex-1" />
              </div>
              <div className="border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-200">
                {group.items.map((update) => (
                  <GeneralUpdateCard
                    key={update.id}
                    update={update}
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeneralUpdatesPage;
