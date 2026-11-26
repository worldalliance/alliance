import {
  PlaceKind,
  type ConditionHolder,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import { type Page } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  DependencyRole,
  DependentEntryKind,
  dependentsOf,
  groupDependents,
  sourcesOf,
  type Dependent,
  type Source,
} from "../../../../lib/formDependencies";
import { formEditorPath } from "../../../../lib/formEditorLink";
import type { VisibilityGroups } from "../../../../lib/visibilityGroups";
import type { ConditionFieldLookup } from "../../../../lib/visibilitySummary";
import { InspectorGroup } from "../kit/InspectorGroup";
import { cn } from "../../../../ui/cn";
import { linkClass } from "../../../../ui/styles";
import {
  CanvasTargetKind,
  describeElement,
  pageTitle,
  placeTarget,
  resolvePlace,
  type CanvasTarget,
} from "../selection/canvasSelection";

const ROLE_LABELS: Record<DependencyRole, string> = {
  [DependencyRole.Visibility]: "visibility",
  [DependencyRole.Required]: "required if",
};

export function describePlace(
  pages: readonly Page[],
  place: FormPlace,
): string {
  const resolved = resolvePlace(pages, place);
  switch (resolved.kind) {
    case PlaceKind.Page:
      return `Page: ${pageTitle(resolved.page)}`;
    case PlaceKind.Element:
      return describeElement(resolved.element);
    case PlaceKind.SubField:
      return `${describeElement(resolved.list)} › ${describeElement(resolved.sub)}`;
    default:
      throw new Error(
        `unknown place: ${JSON.stringify(resolved satisfies never)}`,
      );
  }
}

/** Names the roles a link plays, unless it only governs visibility. */
const rolesNote = (roles: readonly DependencyRole[]) =>
  roles.length === 1 && roles[0] === DependencyRole.Visibility
    ? null
    : ` (${roles.map((role) => ROLE_LABELS[role]).join(", ")})`;

const LINK = cn(linkClass, "min-w-0 truncate text-left");

function LinkList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <InspectorGroup title={label}>
      <ul aria-label={label} className="flex flex-col gap-1.5">
        {children}
      </ul>
    </InspectorGroup>
  );
}

const ROW = "flex min-w-0 items-baseline gap-1 text-fg-muted";

/**
 * The questions the selection's formulas read, and, for a question, what on
 * this form reads it, each linking to where it sits.
 */
export function DependencyLinks({
  pages,
  groups,
  item,
  questionId,
  fieldOf,
  onSelect,
}: {
  pages: readonly Page[];
  groups: VisibilityGroups;
  item: ConditionHolder["formulas"];
  /** The selection's id when it is a question, which formulas can read. */
  questionId: string | null;
  fieldOf: ConditionFieldLookup;
  onSelect: (pageIndex: number, target: CanvasTarget) => void;
}) {
  const sources = sourcesOf(pages, item);
  const entries =
    questionId === null
      ? null
      : groupDependents({
          pages,
          groups,
          dependents: dependentsOf(pages, new Set([questionId])),
        });
  if (sources.length === 0 && entries === null) return null;

  const placeLink = ({ place, roles }: Dependent) => (
    <>
      <button
        type="button"
        onClick={() => onSelect(place.pageIndex, placeTarget(pages, place))}
        title={describePlace(pages, place)}
        className={LINK}
      >
        {describePlace(pages, place)}
      </button>
      {rolesNote(roles)}
    </>
  );

  const sourceLink = (source: Source) => {
    if (source.sourceFormId !== null) {
      const label = `${
        fieldOf(source.fieldId, source.sourceFormId)?.label?.trim() ||
        source.fieldId
      } (form ${source.sourceFormId})`;
      return (
        <>
          <Link
            to={formEditorPath(source.sourceFormId, source.fieldId)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label}, opens in a new tab`}
            title={label}
            className={cn(LINK, "inline-flex items-center gap-1")}
          >
            <span className="truncate">{label}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
          {rolesNote(source.roles)}
        </>
      );
    }
    if (source.place === null) {
      return (
        <span className="text-danger">
          Missing question <code className="font-mono">{source.fieldId}</code>
          {rolesNote(source.roles)}
        </span>
      );
    }
    return placeLink({ place: source.place, roles: source.roles });
  };

  return (
    <>
      {sources.length > 0 && (
        <LinkList label="Depends on">
          {sources.map((source) => (
            <li
              key={`${source.sourceFormId}/${source.fieldId}`}
              className={ROW}
            >
              {sourceLink(source)}
            </li>
          ))}
        </LinkList>
      )}
      {entries &&
        (entries.length === 0 ? (
          <InspectorGroup>
            <p className="text-fg-muted">
              No conditions on this form read this question.
            </p>
          </InspectorGroup>
        ) : (
          <LinkList label="Used by">
            {entries.map((entry) =>
              entry.kind === DependentEntryKind.Single ? (
                <li
                  key={JSON.stringify(entry.dependent.place)}
                  className={ROW}
                >
                  {placeLink(entry.dependent)}
                </li>
              ) : (
                <li key={entry.key}>
                  <button
                    type="button"
                    onClick={() =>
                      onSelect(entry.pageIndex, {
                        kind: CanvasTargetKind.Group,
                        key: entry.key,
                      })
                    }
                    className={LINK}
                  >
                    Shared visibility ·{" "}
                    {withCount(entry.members.length, "element")}
                  </button>
                  <ul
                    aria-label="Group members"
                    className="mt-1.5 ml-1 flex flex-col gap-1.5 border-l border-line pl-3"
                  >
                    {entry.members.map((member) => (
                      <li
                        key={JSON.stringify(member.place)}
                        className={ROW}
                      >
                        {placeLink(member)}
                      </li>
                    ))}
                  </ul>
                </li>
              ),
            )}
          </LinkList>
        ))}
    </>
  );
}
