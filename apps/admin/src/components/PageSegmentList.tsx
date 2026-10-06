import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { FormSchemaValidationError } from "@alliance/common/forms/form-schema-validate";
import type { ReactNode } from "react";
import {
  pageSegments,
  SegmentKind,
  type GroupedPages,
  type PageSegment,
  type VisibilityGroups,
} from "../lib/visibilityGroups";
import { ExpressionScope } from "./form-fields/conditions/expressionBuffers";
import { VisibilityGroupSegment } from "./VisibilityGroupSegment";

type PageSegmentListProps = {
  schema: FormSchema;
  pageIndex: number;
  groups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
  applyGrouped: (grouped: GroupedPages) => void;
  collapsedGroups: ReadonlySet<string>;
  onToggleCollapsed: (key: string) => void;
  validationErrors: FormSchemaValidationError[];
  renderInsertPoint: (loc: {
    groupKey: string | null;
    index: number;
  }) => ReactNode;
  renderMember: (params: { field: PageItem; index: number }) => ReactNode;
};

export function PageSegmentList({
  schema,
  pageIndex,
  groups,
  setGroups,
  applyGrouped,
  collapsedGroups,
  onToggleCollapsed,
  validationErrors,
  renderInsertPoint,
  renderMember,
}: PageSegmentListProps) {
  const fields = schema.pages[pageIndex]?.fields ?? [];
  const segments = pageSegments(fields, groups);
  return segments.map((segment, segmentIndex) => {
    const { key, start, end, body } = segmentLayout(segment, segmentIndex);
    return (
      <div key={key}>
        {renderInsertPoint({ groupKey: null, index: start })}
        {body}
        {end === fields.length &&
          renderInsertPoint({ groupKey: null, index: end })}
      </div>
    );
  });

  function segmentLayout(segment: PageSegment, segmentIndex: number) {
    switch (segment.kind) {
      case SegmentKind.Single: {
        const field = fields[segment.index];
        return {
          key: field.id || segment.index,
          start: segment.index,
          end: segment.index + 1,
          body: renderMember({ field, index: segment.index }),
        };
      }
      case SegmentKind.Group:
        return {
          key: segment.key,
          start: segment.start,
          end: segment.end,
          body: (
            <ExpressionScope.Provider value={`group:${segment.key}`}>
              <VisibilityGroupSegment
                schema={schema}
                pageIndex={pageIndex}
                segments={segments}
                segmentIndex={segmentIndex}
                groups={groups}
                setGroups={setGroups}
                applyGrouped={applyGrouped}
                collapsed={collapsedGroups.has(segment.key)}
                onToggleCollapsed={() => onToggleCollapsed(segment.key)}
                validationErrors={validationErrors}
                renderInsertPoint={renderInsertPoint}
                renderMember={renderMember}
              />
            </ExpressionScope.Provider>
          ),
        };
      default:
        throw new Error(
          `unknown segment: ${JSON.stringify(segment satisfies never)}`,
        );
    }
  }
}
