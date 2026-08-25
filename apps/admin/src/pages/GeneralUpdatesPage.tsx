import { forCount } from "@alliance/common/plural";
import {
  actionsAllGeneralUpdatesAdmin,
  GeneralUpdateAdminDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import GeneralUpdateCard from "../components/GeneralUpdateCard";

const GeneralUpdatesPage: React.FC = () => {
  const [updates, setUpdates] = useState<GeneralUpdateAdminDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadUpdates = useCallback(async () => {
    try {
      const response = await actionsAllGeneralUpdatesAdmin();
      if (response.data) {
        setUpdates(response.data);
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load general updates");
      setLoading(false);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

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

  if (loading) {
    return <p className="p-5">Loading general updates...</p>;
  }

  if (error) {
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
