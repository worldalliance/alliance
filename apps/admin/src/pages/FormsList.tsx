import { errorMessage } from "@alliance/common/errorMessage";
import { withCount } from "@alliance/common/plural";
import {
  ResponseCountStatus,
  useFormResponseCountsAdmin,
  useFormsAdmin,
  type FormResponseCounts,
} from "@alliance/shared/lib/useFormsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";

// The endpoint answers with a row per requested id, zeroes included, so a
// missing entry means unresolved, not none.
const UNCOUNTED: Record<ResponseCountStatus, { label: string; title: string }> =
  {
    [ResponseCountStatus.Pending]: {
      label: "…",
      title: "Counting responses",
    },
    [ResponseCountStatus.Error]: {
      label: "?",
      title: "Could not load the response count",
    },
    // Its batch came back without a row for this form.
    [ResponseCountStatus.Ready]: {
      label: "?",
      title: "Could not load the response count",
    },
  };

const responseCountButton = (
  counts: FormResponseCounts,
  formId: number,
): { label: string; title?: string } => {
  const count = counts.byForm[formId];
  if (count !== undefined) return { label: String(count) };
  return UNCOUNTED[counts.statusByForm[formId] ?? ResponseCountStatus.Error];
};

const ResponsesButton: React.FC<{
  counts: FormResponseCounts;
  formId: number;
  onClick: () => void;
}> = ({ counts, formId, onClick }) => {
  const { label, title } = responseCountButton(counts, formId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-xs font-medium"
    >
      Responses ({label})
    </button>
  );
};

const FormsList: React.FC = () => {
  const { forms, isLoading, isError, deleteForm } = useFormsAdmin();
  const formIds = useMemo(() => forms.map((form) => form.id), [forms]);
  const responseCounts = useFormResponseCountsAdmin(formIds);
  const navigate = useNavigate();
  const toast = useToast();

  const handleDeleteForm = useCallback(
    async (id: number) => {
      if (!confirm("Are you sure you want to delete this form?")) return;
      try {
        await deleteForm(id);
      } catch (err) {
        console.error("Failed to delete form:", err);
        toast.error(
          errorMessage({ error: err, fallback: "Failed to delete form" }),
        );
      }
    },
    [deleteForm, toast],
  );

  const handleEditForm = useCallback(
    (formId: number, actionId: number | undefined) => {
      if (actionId) {
        navigate(`/actions/${actionId}?tab=form`);
      } else {
        navigate(`/forms/${formId}`);
      }
    },
    [navigate],
  );

  return (
    <div className="space-y-4 p-5">
      {isError && forms.length > 0 && (
        <p className="text-red-500 text-sm">
          Could not refresh. Showing the list as of the last successful load.
        </p>
      )}
      {isLoading ? (
        <p>Loading forms...</p>
      ) : isError && forms.length === 0 ? (
        <p className="text-red-500">Failed to load forms</p>
      ) : forms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No forms found.</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {forms.map((form) => (
            <Card key={form.id} style={CardStyle.White}>
              <div
                onClick={() => handleEditForm(form.id, form.usedInAction?.id)}
                className="cursor-pointer"
              >
                <div className="flex justify-between mb-2">
                  <h3 className="font-bold text-sm">
                    {form.title || `Form ${form.id}`}
                  </h3>
                  <div>
                    <span className="text-xs text-zinc-600">ID: {form.id}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteForm(form.id);
                      }}
                      className="ml-2 p-1 text-zinc-600 hover:text-red-500 rounded pt-0 -mt-2"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex flex-row justify-between items-center gap-3">
                  {form.usedInAction && (
                    <span className="text-sm text-green -mt-[1px]">
                      Linked in action: {form.usedInAction.name}
                    </span>
                  )}
                  <div className="flex-1" />
                  <div className="flex items-center gap-3">
                    {form.schemaCounts ? (
                      <p className="text-sm text-zinc-600">
                        {withCount(form.schemaCounts.pages, "page")} •{" "}
                        {withCount(form.schemaCounts.fields, "field")}
                      </p>
                    ) : (
                      <p className="text-sm text-red-600">Unreadable schema</p>
                    )}
                    <ResponsesButton
                      counts={responseCounts}
                      formId={form.id}
                      onClick={() => navigate(`/forms/${form.id}/responses`)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormsList;
