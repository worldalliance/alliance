import type { FormSchema } from "@alliance/common/forms/form-schema";
import { schemaForRow } from "@alliance/common/forms/row-list";
import type { UserDto } from "@alliance/shared/client";
import { useMemo, useRef, useState, type RefObject } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../lib/testData";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import Sheet from "../ui/Sheet";
import { MemberFormRenderer } from "./MemberFormRenderer";
import { PreviewAsUserBar } from "./PreviewAsUserBar";
import { VisibilityProfilePicker } from "./VisibilityProfilePicker";

export type PreviewBodyProps = {
  schema: FormSchema;
  pageIndex: number;
  /** `"preview"` stands for the sample member. */
  userId: number | "preview";
  user: UserDto;
  /** The preview pane's element, for a full-screen panel to portal into. */
  container: RefObject<HTMLElement | null>;
};

/**
 * The previewed form. The pane keys it by member and row, so changing either
 * starts it again at its first step.
 */
export function PreviewBody({
  schema,
  pageIndex,
  userId,
  user,
}: PreviewBodyProps) {
  return (
    <MemberFormRenderer
      schema={schema}
      previewUserId={userId}
      user={user}
      initialPageIndex={pageIndex}
    />
  );
}

/**
 * The Preview mode's whole pane: one control row, then the form as the chosen
 * member (and row) would see it. It passes no `onSubmit`, saves no draft and
 * sends no member analytics, so nothing entered here is written.
 */
export function FormBuilderPreview({
  schema,
  pageIndex,
  previewUserId,
  setPreviewUserId,
}: {
  schema: FormSchema;
  pageIndex: number;
  previewUserId: string;
  setPreviewUserId: (previewUserId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const usersQuery = useUsersAdmin();
  const previewUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const memberIds = useMemo(
    () =>
      previewUsers
        .filter((user) => user.hasActiveContract)
        .map((user) => user.id),
    [previewUsers],
  );
  const [cardPick, setCardPick] = useState<number | null>(null);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [rowIndex, setRowIndex] = useState(0);

  const previewMember =
    previewUserId === "preview"
      ? null
      : (previewUsers.find((user) => String(user.id) === previewUserId) ??
        null);
  const memberUnavailable = previewUserId !== "preview" && !previewMember;

  const list = schema.rowList;
  const previewRow = list?.rows[rowIndex] ?? list?.rows[0];
  const previewSchema = useMemo(
    () =>
      list === undefined ? schema : schemaForRow(schema, previewRow ?? {}),
    [schema, list, previewRow],
  );
  const memberId = previewMember?.id ?? null;
  const rowId = list
    ? Math.min(rowIndex, Math.max(list.rows.length - 1, 0))
    : null;

  return (
    <div ref={container} className="relative min-h-full">
      <PreviewAsUserBar
        previewUserId={previewUserId}
        setPreviewUserId={(userId) => {
          setCardPick(null);
          setPreviewUserId(userId);
        }}
        previewUsers={previewUsers}
        isLoadingPreviewUsers={usersQuery.isLoading}
        previewUsersFailed={usersQuery.isLoadingError}
        retryPreviewUsers={() => void usersQuery.refetch()}
        rowList={list}
        rowIndex={rowIndex}
        setRowIndex={setRowIndex}
        onOpenProfiles={() => setProfilesOpen(true)}
      />
      <div className="p-4 pb-16">
        <div className="mx-auto max-w-3xl rounded-card border border-line bg-surface p-6">
          {!memberUnavailable ? (
            <PreviewBody
              key={`${memberId ?? "none"}:${rowId ?? "none"}`}
              schema={previewSchema}
              pageIndex={pageIndex}
              userId={previewMember?.id ?? "preview"}
              user={previewMember ?? FORM_BUILDER_PREVIEW_USER}
              container={container}
            />
          ) : usersQuery.isLoading ? (
            <p className="text-fg-muted">Loading the member…</p>
          ) : (
            usersQuery.data && (
              <p className="text-danger">
                Member #{previewUserId} isn&apos;t in the user list.
              </p>
            )
          )}
        </div>
      </div>
      <Sheet
        open={profilesOpen}
        onClose={() => setProfilesOpen(false)}
        title="Visibility profiles"
        size="peek"
      >
        <div className="p-card">
          <VisibilityProfilePicker
            schema={schema}
            userIds={memberIds}
            selectedUserId={cardPick}
            onSelect={(userId) => {
              setCardPick(userId);
              setPreviewUserId(String(userId));
              setProfilesOpen(false);
            }}
            empty={
              <p className="text-fg-muted">
                Nothing in this form depends on who the member is.
              </p>
            }
          />
        </div>
      </Sheet>
    </div>
  );
}
