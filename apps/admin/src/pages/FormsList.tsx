import { FormSchema } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import {
  FormDto,
  tasksDeleteFormAdmin,
  tasksGetFormResponsesAdmin,
  tasksListFormsAdmin,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

export type Form = Pick<FormDto, "id" | "title" | "usedInAction"> & {
  schema: FormSchema;
};

const countPages = (schema: FormSchema) => schema.pages?.length ?? 0;

const countFields = (schema: FormSchema) =>
  schema.pages?.reduce(
    (total, page) => total + (page.fields?.length ?? 0),
    0,
  ) ?? 0;

const FormsList: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [formsLoading, setFormsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [responseCounts, setResponseCounts] = useState<Record<number, number>>(
    {},
  );
  const navigate = useNavigate();

  const loadForms = useCallback(async () => {
    try {
      const response = await tasksListFormsAdmin();
      if (response.data) {
        setForms(response.data as unknown as Form[]);
      }
      setFormsLoading(false);
    } catch (err) {
      setError("Failed to load forms");
      setFormsLoading(false);
      console.error(err);
    }
  }, []);

  const handleDeleteForm = useCallback(
    async (id: number) => {
      if (confirm("Are you sure you want to delete this form?")) {
        try {
          await tasksDeleteFormAdmin({ path: { id } });
          // Reload forms after successful deletion
          loadForms();
        } catch (err) {
          console.error("Failed to delete form:", err);
          alert("Failed to delete form. Please try again.");
        }
      }
    },
    [loadForms],
  );

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  // After forms load, fetch response counts for each form
  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      const entries = await Promise.all(
        forms.map(async (f) => {
          try {
            const res = await tasksGetFormResponsesAdmin({
              path: { id: f.id },
            });
            return [f.id, (res.data ?? []).length] as const;
          } catch (e) {
            console.error("Failed to get responses for form", f.id, e);
            return [f.id, 0] as const;
          }
        }),
      );
      if (!cancelled) {
        const map: Record<number, number> = {};
        for (const [id, count] of entries) map[id] = count;
        setResponseCounts(map);
      }
    };
    if (forms.length > 0) fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [forms]);

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
      {formsLoading ? (
        <p>Loading forms...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
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
                    <p className="text-sm text-zinc-600">
                      {withCount(countPages(form.schema), "page")} •{" "}
                      {withCount(countFields(form.schema), "field")}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/forms/${form.id}/responses`);
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-xs font-medium"
                    >
                      Responses ({responseCounts[form.id] ?? 0})
                    </button>
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
