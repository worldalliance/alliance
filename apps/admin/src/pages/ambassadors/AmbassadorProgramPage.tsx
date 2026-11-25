import type {
  AmbassadorInviteProjectionDto,
  AmbassadorProgramMemberDto,
} from "@alliance/shared/client/types.gen";
import { useMemo, useState } from "react";
import { adminRefusalMessage, rowRefusalMessage } from "../../lib/adminRefusal";
import { formatDate, formatDateTime } from "../../lib/formatDate";
import { countOf, formatCount } from "../../lib/formatNumber";
import {
  useAmbassadorProgramAdmin,
  useUpdateAmbassadorProgramMemberAdmin,
} from "../../lib/useAmbassadorProgramAdmin";
import { useGraphUsersAdmin } from "../../lib/useGraphUsersAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Panel, PanelNote, PanelStat } from "../../ui/templates/Overview";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import {
  matchesRecord,
  memberDisplayName,
  ProgramSection,
  remainingCurrentTarget,
  SECTION,
} from "./programRules";
import { ProgramSectionList } from "./ProgramSectionList";

const SECTIONS = [ProgramSection.Invited, ProgramSection.Active] as const;
const NO_MEMBERS: AmbassadorProgramMemberDto[] = [];

const removalKey = (section: ProgramSection, userId: number) =>
  `${section}:${userId}`;

function Projection({
  projection,
  active,
}: {
  projection: AmbassadorInviteProjectionDto;
  /** Every active participant, whatever the search, as the checkpoints are. */
  active: readonly AmbassadorProgramMemberDto[];
}) {
  return (
    <Panel
      title="Projected growth"
      // From ambassador-invite-stats.service: the projection is computed
      // when the page loads.
      description={`As of ${formatDateTime(projection.generatedAt)}`}
      // Panel clips its overflow, so in the scrolling card column it would
      // otherwise shrink to nothing.
      className="shrink-0"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <PanelStat
            label="Active goal target left"
            value={formatCount(remainingCurrentTarget(active))}
          />
          {projection.points.map((point) => (
            <PanelStat
              key={point.date}
              label={`By ${formatDate(point.date)}`}
              value={formatCount(point.projectedSuccessfulRecruits)}
            />
          ))}
        </div>
        {projection.points.length === 0 && (
          <PanelNote>No active or upcoming invite goals to project.</PanelNote>
        )}
        <p className="max-w-prose text-caption text-fg-muted">
          For every active or future goal, the estimate takes the successful
          recruits not yet earned, spreads them evenly from today or the goal's
          start through its due date, and sums those estimates at each date.
        </p>
      </div>
    </Panel>
  );
}

function BodySkeleton() {
  return (
    <div className="flex flex-col gap-section">
      <Skeleton className="h-40 w-full rounded-card" />
      <div className="grid grid-cols-1 gap-section @6xl:grid-cols-2">
        {[0, 1].map((column) => (
          <div key={column} className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AmbassadorProgramPage() {
  const [q, setQ] = useListSearch();
  const program = useAmbassadorProgramAdmin();
  const pool = useGraphUsersAdmin();
  const update = useUpdateAmbassadorProgramMemberAdmin();
  const [removing, setRemoving] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [removeError, setRemoveError] = useState<string | null>(null);

  const records = program.data?.members ?? NO_MEMBERS;
  const shown = useMemo(
    () => records.filter((member) => matchesRecord(member, q)),
    [records, q],
  );
  const inSection = (
    section: ProgramSection,
    from: readonly AmbassadorProgramMemberDto[],
  ) => from.filter(SECTION[section].has);

  const remove = (
    section: ProgramSection,
    member: AmbassadorProgramMemberDto,
    onRemoved: () => void,
  ) => {
    const key = removalKey(section, member.userId);
    setRemoveError(null);
    setRemoving((keys) => new Set(keys).add(key));
    update
      .mutateAsync({ userId: member.userId, body: SECTION[section].unflag })
      .then(onRemoved)
      .catch((error: unknown) =>
        setRemoveError(
          rowRefusalMessage(
            error,
            `Couldn't remove ${memberDisplayName(member.user)} from ${SECTION[section].title.toLowerCase()}`,
          ),
        ),
      )
      .finally(() =>
        setRemoving((keys) => {
          const next = new Set(keys);
          next.delete(key);
          return next;
        }),
      );
  };

  const description = program.data
    ? [
        `${formatCount(inSection(ProgramSection.Invited, records).length)} invited`,
        `${formatCount(inSection(ProgramSection.Active, records).length)} active`,
        countOf(
          records.reduce((total, m) => total + m.interactions.length, 0),
          "interaction",
        ),
      ].join(" · ")
    : "";

  const poolError = pool.isLoadingError
    ? `Couldn't load members to add: ${adminRefusalMessage(pool.error, LOAD_FAILED_FALLBACK)}`
    : null;

  return (
    <Page
      fill
      place={PlaceId.AmbassadorProgram}
      description={description}
      banner={
        <>
          <RefreshFailedBanner
            things="the ambassador program"
            query={program}
          />
          {removeError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => setRemoveError(null)}
                >
                  Dismiss
                </Button>
              }
            >
              {removeError}
            </Banner>
          )}
        </>
      }
    >
      <FilterBar
        count={listCount({
          shown: shown.length,
          total: program.data ? records.length : undefined,
          noun: "member",
        })}
      >
        <SearchField label="Filter records" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent cards>
        <ContentState
          things="the ambassador program"
          query={program}
          refreshBanner={false}
          skeleton={<BodySkeleton />}
        >
          {program.data && (
            <Projection
              projection={program.data.projection}
              active={inSection(ProgramSection.Active, records)}
            />
          )}
          <div className="grid grid-cols-1 items-start gap-section @6xl:grid-cols-2">
            {SECTIONS.map((section) => (
              <ProgramSectionList
                key={section}
                section={section}
                members={inSection(section, shown)}
                total={inSection(section, records)}
                pool={pool.data ?? []}
                poolError={poolError}
                removingIds={
                  new Set(
                    records
                      .filter((m) =>
                        removing.has(removalKey(section, m.userId)),
                      )
                      .map((m) => m.userId),
                  )
                }
                onRemove={(member, onRemoved) =>
                  remove(section, member, onRemoved)
                }
              />
            ))}
          </div>
        </ContentState>
      </ListContent>
    </Page>
  );
}
