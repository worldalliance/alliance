import { rowLabel } from "@alliance/common/forms/row-list";
import type { RowList } from "@alliance/common/forms/row-list-schema";
import type { UserDto } from "@alliance/shared/client";
import Button, { ButtonVariant } from "../ui/Button";
import { Select } from "../ui/Select";
import UserSelect from "../ui/UserSelect";

export interface PreviewAsUserBarProps {
  previewUserId: string;
  setPreviewUserId: (value: string) => void;
  previewUsers: UserDto[];
  isLoadingPreviewUsers: boolean;
  previewUsersFailed: boolean;
  retryPreviewUsers: () => void;
  rowList: RowList | undefined;
  rowIndex: number;
  setRowIndex: (index: number) => void;
  onOpenProfiles: () => void;
}

/**
 * The preview's one control row. Its height is fixed, so picking a member,
 * which swaps the search field for a chip, never moves the preview below.
 */
export function PreviewAsUserBar({
  previewUserId,
  setPreviewUserId,
  previewUsers,
  isLoadingPreviewUsers,
  previewUsersFailed,
  retryPreviewUsers,
  rowList,
  rowIndex,
  setRowIndex,
  onOpenProfiles,
}: PreviewAsUserBarProps) {
  const selectedUserIds =
    previewUserId === "preview" ? [] : [Number(previewUserId)];
  const handleChange = (userIds: number[]) =>
    setPreviewUserId(userIds.length > 0 ? String(userIds[0]) : "preview");

  return (
    <div className="sticky top-0 z-10 flex h-24 shrink-0 items-start gap-4 border-b border-line bg-surface px-4 pt-2">
      <div className="w-72 shrink-0">
        <UserSelect
          users={previewUsers}
          selectedUserIds={selectedUserIds}
          onChange={handleChange}
          loading={isLoadingPreviewUsers}
          loadFailed={false}
          label="Preview as"
          single
        />
        {previewUsersFailed && (
          <p
            role="alert"
            className="-mt-1 flex items-center gap-2 text-caption text-danger"
          >
            Couldn&apos;t load users
            <button
              type="button"
              onClick={retryPreviewUsers}
              className="rounded-sm underline focus-ring"
            >
              Try again
            </button>
          </p>
        )}
      </div>
      {rowList && rowList.rows.length > 0 && (
        <label className="flex shrink-0 flex-col gap-1 font-medium">
          Preview as row
          <Select
            value={Math.min(rowIndex, rowList.rows.length - 1)}
            onChange={(event) => setRowIndex(Number(event.target.value))}
            className="w-auto max-w-56 font-normal"
          >
            {rowList.rows.map((row, index) => (
              <option key={index} value={index}>
                {rowLabel(row, rowList.keyFields) || `Row ${index + 1}`}
              </option>
            ))}
          </Select>
        </label>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 self-stretch">
        <p className="text-caption text-fg-muted">
          Nothing you enter here is saved.
        </p>
        <Button variant={ButtonVariant.Default} onClick={onOpenProfiles}>
          Visibility profiles…
        </Button>
      </div>
    </div>
  );
}
