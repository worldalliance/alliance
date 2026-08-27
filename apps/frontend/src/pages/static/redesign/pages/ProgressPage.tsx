import { FEATURED_IMPACT_ACTIONS } from "../../../../content/featuredImpactActions";
import { RedesignPage } from "../links";
import {
  ACTIONS_BODY,
  ACTIONS_TITLE,
  HIDDEN_IMPACT_ACTIONS,
  impactStats,
  membersAtAction,
  PROGRESS_LEDE,
  PROGRESS_TITLE,
  STATS_BODY,
  STATS_TITLE,
} from "../pageContent";
import { ImpactCard } from "../sections/PageCards";
import { PageBand, PageShell, BandHeading, BandLede } from "../sections/PageShell";
import { PANEL_GREEN, type RedesignTheme } from "../theme";
import { RdTexturedPanel } from "../ui";

const shown = FEATURED_IMPACT_ACTIONS.filter(
  (action) => !HIDDEN_IMPACT_ACTIONS.includes(action.actionId),
);

const withPhoto = shown.filter((action) => action.imageSrc);
const textOnly = shown.filter((action) => !action.imageSrc);

/** The headline figures, each tied back to the action that produced it. */
function Statistics() {
  return (
    <PageBand>
      <RdTexturedPanel tint={PANEL_GREEN}>
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="rd-headline text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            {STATS_TITLE}
          </h2>
          <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
            {STATS_BODY}
          </p>
        </div>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {impactStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 border-t border-white/20 pt-4"
            >
              <dt className="rd-headline text-[2.4rem] leading-none text-white">
                {stat.value}
              </dt>
              <dd className="text-[1rem] leading-snug text-white/75">
                {stat.label}
                <span className="mt-1.5 block text-[0.85rem] text-white/50">
                  {`${stat.members} members at the time`}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </RdTexturedPanel>
    </PageBand>
  );
}

/**
 * Photos hold the left column and the written outcomes the right, so the text
 * cards can hug their copy. Roughly three of them stand beside one photo.
 */
function Actions() {
  return (
    <PageBand className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BandHeading>{ACTIONS_TITLE}</BandHeading>
        <BandLede>{ACTIONS_BODY}</BandLede>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {withPhoto.map((action) => (
            <ImpactCard
              key={action.actionId}
              action={action}
              members={membersAtAction[action.actionId]}
              className="border border-[var(--rd-ink)]/10"
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {textOnly.map((action) => (
            <ImpactCard
              key={action.actionId}
              action={action}
              members={membersAtAction[action.actionId]}
              className="border border-[var(--rd-ink)]/10"
            />
          ))}
        </div>
      </div>
    </PageBand>
  );
}

export function RedesignProgressPage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Progress}
      title={PROGRESS_TITLE}
      lede={PROGRESS_LEDE}
    >
      <Statistics />
      <Actions />
    </PageShell>
  );
}
