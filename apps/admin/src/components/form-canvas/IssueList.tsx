import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  PlaceKind,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import type {
  FormSchema,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { CircleAlert } from "lucide-react";
import {
  IssueTargetKind,
  type FormIssue,
  type IssueIndex,
  type IssueTarget,
} from "../../lib/formIssues";
import { cn } from "../../ui/cn";
import {
  CanvasTargetKind,
  ChildKind,
  describeElement,
  pageTitle,
  placeTarget,
  type CanvasTarget,
  type ResolvedTarget,
} from "./canvasSelection";
import { SidebarSection } from "./sidebarSections";

export enum IssueGate {
  Save = "save",
  Preview = "preview",
}

/** Where an issue sits, as the issue list names it. */
export function issueLocation(schema: FormSchema, target: IssueTarget): string {
  switch (target.kind) {
    case IssueTargetKind.Place: {
      const { place } = target;
      const page = schema.pages[place.pageIndex]!;
      if (place.kind === PlaceKind.Page) return pageTitle(page);
      const element = page.fields[place.index]!;
      const sub =
        place.kind === PlaceKind.SubField && element.kind === "list"
          ? element.fields[place.subIndex]
          : undefined;
      return [pageTitle(page), describeElement(element)]
        .concat(sub ? describeElement(sub) : [])
        .join(" › ");
    }
    case IssueTargetKind.Group:
      return `${pageTitle(schema.pages[target.pageIndex]!)} › Shared visibility`;
    case IssueTargetKind.OutputView: {
      const view = schema.outputViews?.find(({ id }) => id === target.viewId);
      return `Output view: ${view?.title || "Untitled view"}`;
    }
    case IssueTargetKind.Variables:
      return "Formulas";
    case IssueTargetKind.Rows:
      return "Rows";
    case IssueTargetKind.Form:
      return "Form";
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

/** Shows where `issue` is repaired. */
export function openIssue(
  { target, inConditions }: FormIssue,
  {
    pages,
    select,
    showOutputView,
    showVariables,
    showRows,
  }: {
    pages: readonly Page[];
    select: (
      pageIndex: number,
      target: CanvasTarget,
      section: SidebarSection,
    ) => void;
    showOutputView: (viewId: string) => void;
    showVariables: () => void;
    showRows: () => void;
  },
): void {
  switch (target.kind) {
    case IssueTargetKind.Place:
      return select(
        target.place.pageIndex,
        placeTarget(pages, target.place),
        inConditions ? SidebarSection.Conditions : SidebarSection.Content,
      );
    case IssueTargetKind.Group:
      return select(
        target.pageIndex,
        { kind: CanvasTargetKind.Group, key: target.key },
        SidebarSection.Conditions,
      );
    case IssueTargetKind.OutputView:
      return showOutputView(target.viewId);
    case IssueTargetKind.Variables:
      return showVariables();
    case IssueTargetKind.Rows:
      return showRows();
    case IssueTargetKind.Form:
      return;
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

export type IssueRow = {
  location: string;
  message: string;
  /** Null where no editor can show the issue's target. */
  onGo: (() => void) | null;
};

export type SourceCheck = {
  pending: number;
  failed: number;
  onRetry: () => void;
};

export type LoadFailure = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
};

/** The canvas and outline marker on an entry with issues. */
export function IssueMarker({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  const label = withCount(count, "issue");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("shrink-0 text-danger", className)}
    >
      <CircleAlert aria-hidden="true" className="size-3.5" />
    </span>
  );
}

const shortName = (item: PageItem) =>
  elementInternalDescriptor(item, { maxTextLength: 40 });

/** The issues the sidebar lists above what `target` selects on the page. */
export function selectionIssues({
  index,
  page,
  pageIndex,
  target,
}: {
  index: IssueIndex;
  page: Page;
  pageIndex: number;
  target: ResolvedTarget;
}): string[] {
  const place = (at: FormPlace) =>
    index.at({ kind: IssueTargetKind.Place, place: at });
  const ofElement = (at: number, { labelled }: { labelled: boolean }) => {
    const element = page.fields[at]!;
    const prefix = labelled ? `${shortName(element)}: ` : "";
    const own = place({ kind: PlaceKind.Element, pageIndex, index: at }).map(
      (message) => prefix + message,
    );
    if (element.kind !== "list") return own;
    return own.concat(
      element.fields.flatMap((sub, subIndex) =>
        place({ kind: PlaceKind.SubField, pageIndex, index: at, subIndex }).map(
          (message) => `${shortName(sub)}: ${message}`,
        ),
      ),
    );
  };
  switch (target.kind) {
    case CanvasTargetKind.Page:
      return place({ kind: PlaceKind.Page, pageIndex });
    case CanvasTargetKind.Element:
      return target.child?.kind === ChildKind.SubField
        ? place({
            kind: PlaceKind.SubField,
            pageIndex,
            index: target.index,
            subIndex: target.child.index,
          })
        : ofElement(target.index, { labelled: false });
    case CanvasTargetKind.Group: {
      const members = Array.from(
        { length: target.end - target.start },
        (_, offset) => ofElement(target.start + offset, { labelled: true }),
      );
      return index
        .at({ kind: IssueTargetKind.Group, pageIndex, key: target.key })
        .concat(...members);
    }
    case CanvasTargetKind.Range:
      return [];
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}
