import {
  PlaceKind,
  type ConditionHolder,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import { type Page } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { cn } from "@alliance/shared/styles/util";
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
} from "../../lib/formDependencies";
import { formEditorPath } from "../../lib/formEditorLink";
import type { VisibilityGroups } from "../../lib/visibilityGroups";
import type { ConditionFieldLookup } from "../../lib/visibilitySummary";
import {
  CanvasTargetKind,
  describeElement,
  pageTitle,
  placeTarget,
  resolvePlace,
  type CanvasTarget,
} from "./canvasSelection";

const ROLE_LABELS: Record<DependencyRole, string> = {
  [DependencyRole.Visibility]: "visibility",
  [DependencyRole.Required]: "required if",
};

function describePlace(pages: readonly Page[], place: FormPlace): string {
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

const LINK =
  "min-w-0 truncate text-left text-sm text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function LinkList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </h3>
      <ul aria-label={label} className="space-y-1">
        {children}
      </ul>
    </div>
  );
}

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
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Link>
          {rolesNote(source.roles)}
        </>
      );
    }
    if (source.place === null) {
      return (
        <span className="text-sm text-red-700">
          Missing question <code className="font-mono">{source.fieldId}</code>
          {rolesNote(source.roles)}
        </span>
      );
    }
    return placeLink({ place: source.place, roles: source.roles });
  };

  return (
    <div className="space-y-3 border-t border-gray-200 pt-3">
      {sources.length > 0 && (
        <LinkList label="Depends on">
          {sources.map((source) => (
            <li
              key={`${source.sourceFormId}/${source.fieldId}`}
              className="flex items-baseline gap-1 text-sm text-gray-500"
            >
              {sourceLink(source)}
            </li>
          ))}
        </LinkList>
      )}
      {entries &&
        (entries.length === 0 ? (
          <p className="text-sm text-gray-500">
            No conditions on this form read this question.
          </p>
        ) : (
          <LinkList label="Used by">
            {entries.map((entry) =>
              entry.kind === DependentEntryKind.Single ? (
                <li
                  key={JSON.stringify(entry.dependent.place)}
                  className="flex items-baseline gap-1 text-sm text-gray-500"
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
                    className="ml-3 space-y-1 border-l border-amber-200 pl-2"
                  >
                    {entry.members.map((member) => (
                      <li
                        key={JSON.stringify(member.place)}
                        className="flex items-baseline gap-1 text-sm text-gray-500"
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
    </div>
  );
}
