import { cn } from "@alliance/shared/styles/util";
import React, { useMemo, useState } from "react";
import { GrowthProjectionPanel } from "../components/ambassador-program/GrowthProjectionPanel";
import { ProgramSection } from "../components/ambassador-program/programSection";
import { ProgramSectionPanel } from "../components/ambassador-program/ProgramSectionPanel";
import {
  useAmbassadorProgramAdmin,
  useCreateAmbassadorProgramInteractionAdmin,
  useUpdateAmbassadorProgramMemberAdmin,
  useUpsertAmbassadorProgramMemberAdmin,
} from "../lib/useAmbassadorProgramAdmin";
import { useGraphUsersAdmin } from "../lib/useGraphUsersAdmin";

const AmbassadorProgramPage: React.FC = () => {
  const [filter, setFilter] = useState("");

  const dashboardQuery = useAmbassadorProgramAdmin();

  const membersQuery = useGraphUsersAdmin();

  const upsertMember = useUpsertAmbassadorProgramMemberAdmin();
  const updateMember = useUpdateAmbassadorProgramMemberAdmin();
  const createInteraction = useCreateAmbassadorProgramInteractionAdmin();

  const records = useMemo(
    () => dashboardQuery.data?.members ?? [],
    [dashboardQuery.data?.members],
  );
  const memberPool = useMemo(
    () => membersQuery.data ?? [],
    [membersQuery.data],
  );
  const filterTerm = filter.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    if (!filterTerm) {
      return records;
    }
    return records.filter((record) => {
      const tags = (record.user.tags ?? []).map((tag) => tag.name).join(" ");
      return `${record.user.name ?? ""} ${record.user.email ?? ""} ${tags}`
        .toLowerCase()
        .includes(filterTerm);
    });
  }, [filterTerm, records]);

  const invited = filteredRecords.filter((member) => member.invited);
  const active = filteredRecords.filter((member) => member.activeParticipant);
  const invitedIds = useMemo(
    () =>
      new Set(records.filter((member) => member.invited).map((m) => m.userId)),
    [records],
  );
  const activeIds = useMemo(
    () =>
      new Set(
        records
          .filter((member) => member.activeParticipant)
          .map((member) => member.userId),
      ),
    [records],
  );

  const pending =
    upsertMember.isPending ||
    updateMember.isPending ||
    createInteraction.isPending;

  const handleAdd = async (userId: number, section: ProgramSection) => {
    switch (section) {
      case "invited":
        await upsertMember.mutateAsync({ userId, invited: true });
        break;
      case "active":
        await upsertMember.mutateAsync({ userId, activeParticipant: true });
        break;
      default:
        throw new Error(`unknown program section: ${section satisfies never}`);
    }
  };

  const handleRemove = async (userId: number, section: ProgramSection) => {
    switch (section) {
      case "invited":
        await updateMember.mutateAsync({ userId, body: { invited: false } });
        break;
      case "active":
        await updateMember.mutateAsync({
          userId,
          body: { activeParticipant: false },
        });
        break;
      default:
        throw new Error(`unknown program section: ${section satisfies never}`);
    }
  };

  const error =
    dashboardQuery.error ||
    membersQuery.error ||
    upsertMember.error ||
    updateMember.error ||
    createInteraction.error;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-6 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Ambassador program</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track invite outreach, active participants, and dated CRM notes.
            </p>
          </div>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter records"
            className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm lg:w-80"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Invited", records.filter((member) => member.invited).length],
            [
              "Active",
              records.filter((member) => member.activeParticipant).length,
            ],
            [
              "Interactions",
              records.reduce(
                (total, member) => total + member.interactions.length,
                0,
              ),
            ],
          ].map(([label, value]) => (
            <div key={label} className="border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <GrowthProjectionPanel
          projection={dashboardQuery.data?.projection}
          activeParticipants={active}
        />

        {error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Something went wrong while saving or loading the ambassador program.
          </div>
        )}

        <div
          className={cn(
            "grid grid-cols-1 gap-6 xl:grid-cols-2",
            dashboardQuery.isLoading || membersQuery.isLoading
              ? "opacity-60"
              : "opacity-100",
          )}
        >
          <ProgramSectionPanel
            section="invited"
            members={invited}
            memberPool={memberPool}
            existingUserIds={invitedIds}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onAddInteraction={async (body) => {
              await createInteraction.mutateAsync(body);
            }}
            mutationPending={pending}
          />
          <ProgramSectionPanel
            section="active"
            members={active}
            memberPool={memberPool}
            existingUserIds={activeIds}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onAddInteraction={async (body) => {
              await createInteraction.mutateAsync(body);
            }}
            mutationPending={pending}
          />
        </div>
      </div>
    </main>
  );
};

export default AmbassadorProgramPage;
