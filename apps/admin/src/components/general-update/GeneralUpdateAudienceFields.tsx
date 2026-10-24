import { cn } from "@alliance/shared/styles/util";
import UserSelect, {
  type useSelectableUsers,
} from "@alliance/sharedweb/ui/UserSelect";
import React, { useCallback } from "react";
import type { useTagsAdmin } from "../../lib/useTagsAdmin";
import FormSection from "../FormSection";
import type { GeneralUpdateFieldsProps } from "./generalUpdateForm";

type Props = GeneralUpdateFieldsProps & {
  tags: ReturnType<typeof useTagsAdmin>;
  users: ReturnType<typeof useSelectableUsers>;
};

const GeneralUpdateAudienceFields: React.FC<Props> = ({
  form,
  setForm,
  tags: { tags: availableTags, isLoading: tagsLoading },
  users: {
    users: availableUsers,
    isLoading: usersLoading,
    isLoadingError: usersError,
  },
}) => {
  const handleToggleTag = useCallback(
    (tagId: string) => {
      setForm((prev) => ({
        ...prev,
        tagIds: prev.tagIds.includes(tagId)
          ? prev.tagIds.filter((t) => t !== tagId)
          : [...prev.tagIds, tagId],
      }));
    },
    [setForm],
  );

  const handleManualCohortChange = useCallback(
    (ids: number[]) => {
      setForm((prev) => ({
        ...prev,
        manualCohortUserIds: ids,
      }));
    },
    [setForm],
  );

  return (
    <FormSection title="Participating Users">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Participating Tags
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Updates without tags will not be shown to any users, unless Manual
            User Cohort is enabled.
          </p>
          {tagsLoading ? (
            <p className="text-sm text-gray-500">Loading tags...</p>
          ) : availableTags.length ? (
            <div className="grid gap-2 sm:grid-cols-4">
              {availableTags.map((tag) => {
                const checked = form.tagIds.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                      checked
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={checked}
                      onChange={() => handleToggleTag(tag.id)}
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="font-medium text-gray-800">
                        {tag.name}
                      </span>
                      {tag.publicDisplayName && (
                        <span className="text-xs text-gray-500">
                          {tag.publicDisplayName}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No tags available. Create one in the tags dashboard.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Manual User Cohort{" "}
              {form.useManualCohort
                ? `(${form.manualCohortUserIds.length})`
                : ""}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.useManualCohort}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    useManualCohort: e.target.checked,
                    manualCohortUserIds: e.target.checked
                      ? prev.manualCohortUserIds
                      : [],
                  }))
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">Enable</span>
            </label>
          </div>
          {form.useManualCohort ? (
            <UserSelect
              users={availableUsers}
              selectedUserIds={form.manualCohortUserIds}
              onChange={handleManualCohortChange}
              loading={usersLoading}
              loadFailed={usersError}
              label="Select users"
            />
          ) : (
            <p className="text-xs text-gray-500">
              Enable to manually select specific users for this update.
            </p>
          )}
        </div>
      </div>
    </FormSection>
  );
};

export default GeneralUpdateAudienceFields;
