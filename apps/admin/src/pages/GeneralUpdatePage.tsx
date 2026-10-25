import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import {
  CreateGeneralUpdateDto,
  GeneralUpdateAdminDto,
  UpdateGeneralUpdateDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { cn } from "@alliance/shared/styles/util";
import {
  formatLocalDateTime,
  resolveDateValue,
} from "@alliance/sharedweb/ui/DateTimePicker";
import { useSelectableUsers } from "@alliance/sharedweb/ui/UserSelect";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { FormBuilder } from "../components/FormBuilder";
import FormSection from "../components/FormSection";
import GeneralUpdateAudienceFields from "../components/general-update/GeneralUpdateAudienceFields";
import {
  usesSuiteSchedule,
  withSuite,
  type GeneralUpdateForm,
} from "../components/general-update/generalUpdateForm";
import GeneralUpdateScheduleFields from "../components/general-update/GeneralUpdateScheduleFields";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";
import { useGeneralUpdateAdmin } from "../lib/useGeneralUpdateAdmin";
import { useSearchParamTab } from "../lib/useSearchParamTab";
import { useTagsAdmin } from "../lib/useTagsAdmin";

const tabs = ["details", "content"] as const;

const emptyForm: GeneralUpdateForm = {
  name: "",
  startDate: "",
  endDate: "",
  useManualCohort: false,
  manualCohortUserIds: [],
  tagIds: [],
  suiteIds: [],
};

const GeneralUpdatePage: React.FC = () => {
  const { id: idParam } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTab, onTabChange] = useSearchParamTab(tabs, "details");

  const isNew = !idParam || idParam === "new";
  const id = !isNew && idParam ? parseInt(idParam, 10) : null;
  const updateId = id == null || isNaN(id) ? null : id;

  const {
    query,
    create,
    update: updateMutation,
    saveSchema,
  } = useGeneralUpdateAdmin(updateId);
  const update = query.data;
  const saving = create.isPending || updateMutation.isPending;
  const createUpdate = create.mutateAsync;
  const saveUpdate = updateMutation.mutateAsync;
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<GeneralUpdateForm>(emptyForm);
  const [formUpdateId, setFormUpdateId] = useState<number | null>(null);

  // A copy cached by an earlier visit may be stale, and saving a form filled
  // from it would write those stale details back.
  if (
    update &&
    query.isFetchedAfterMount &&
    !query.isError &&
    formUpdateId !== update.id
  ) {
    setFormUpdateId(update.id);
    setForm({
      name: update.name,
      startDate: formatLocalDateTime(
        resolveDateValue(update.startDate),
        "minute",
      ),
      endDate: formatLocalDateTime(resolveDateValue(update.endDate), "minute"),
      useManualCohort: update.useManualCohort,
      manualCohortUserIds: update.manualCohortUserIds ?? [],
      tagIds: update.tags?.map((t) => t.id) ?? [],
      suiteIds: update.suites?.map((s) => s.id) ?? [],
    });
  }

  const tags = useTagsAdmin();
  const { suites } = useActionSuitesAdmin();
  const users = useSelectableUsers();

  useEffect(() => {
    if (!isNew) return;
    const suiteIdParam = searchParams.get("suiteId");
    if (!suiteIdParam) return;
    const suiteId = parseInt(suiteIdParam, 10);
    if (isNaN(suiteId)) return;
    setForm((prev) => withSuite(prev, suiteId));
  }, [isNew, searchParams]);

  const hasSuites = usesSuiteSchedule(form);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      try {
        const body: CreateGeneralUpdateDto = {
          name: form.name,
          startDate:
            !hasSuites && form.startDate
              ? new Date(form.startDate).toISOString()
              : undefined,
          endDate:
            !hasSuites && form.endDate
              ? new Date(form.endDate).toISOString()
              : undefined,
          useManualCohort: form.useManualCohort,
          manualCohortUserIds: form.useManualCohort
            ? form.manualCohortUserIds
            : [],
          tagIds: form.tagIds,
          suiteIds: form.suiteIds,
        } satisfies UpdateGeneralUpdateDto;
        if (isNew) {
          const created = await createUpdate(body);
          navigate(`/general-updates/${created.id}`);
        } else if (update) {
          await saveUpdate(body);
        }
      } catch (err) {
        setError("Failed to save general update");
        console.error(err);
      }
    },
    [isNew, update, form, hasSuites, navigate, createUpdate, saveUpdate],
  );

  const formContent = (
    <>
      <FormSection
        title="Title"
        description="Shown to members at the top of the general update."
      >
        <label htmlFor="name" className="sr-only">
          Title
        </label>
        <textarea
          id="name"
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
          rows={1}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        />
      </FormSection>

      <FormSection title="Priority">
        <a
          href="/priority"
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Manage priority
        </a>
      </FormSection>

      <GeneralUpdateScheduleFields
        form={form}
        setForm={setForm}
        suites={suites}
      />

      <GeneralUpdateAudienceFields
        form={form}
        setForm={setForm}
        tags={tags}
        users={users}
      />

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate("/general-updates")}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 mr-3 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 text-sm font-medium"
          disabled={saving}
        >
          {saving
            ? isNew
              ? "Creating..."
              : "Saving..."
            : isNew
              ? "Create General Update"
              : "Save Changes"}
        </button>
      </div>
    </>
  );

  const formFilled = updateId === null || formUpdateId === updateId;

  if (!formFilled && !query.isError) {
    return (
      <div className="p-8">
        <title>General Update - Admin</title>
        Loading general update...
      </div>
    );
  }

  if (!formFilled) {
    return (
      <div className="p-8">
        <title>General Update - Admin</title>
        <p className="text-red-500">
          {thrownStatus(query.error) === 404
            ? "General update not found"
            : "Failed to load general update"}
        </p>
        <button
          onClick={() => navigate("/general-updates")}
          className="mt-4 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
      </div>
    );
  }

  const pageTitle = isNew
    ? "Create General Update"
    : (update?.name ?? "General Update");

  const renderContentTab = (generalUpdate: GeneralUpdateAdminDto) => {
    // Editing content this build can't parse would save back whatever the
    // builder made of it, dropping the parts it didn't understand.
    const storedSchema = readDisplayOnlySchema(generalUpdate.schema);
    if (!storedSchema) {
      return (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
          role="alert"
        >
          <p className="font-medium">This update can&apos;t be edited here</p>
          <p className="mt-1 text-sm">
            Its content was saved by a newer version of the admin panel. Refresh
            the page to pick that version up.
          </p>
        </div>
      );
    }
    return (
      <FormBuilder
        displayOnly
        initialSchema={displayOnlyToFormSchema(storedSchema)}
        initialSnapshotId={generalUpdate.schemaSnapshotId}
        title={generalUpdate.name}
        setFormId={() => {}}
        onSave={saveSchema}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      <title>{pageTitle} - Admin</title>
      <div className="p-5 pb-0 flex flex-row justify-between w-full">
        <h1 className="text-[#111] text-[16pt] font-bold">{pageTitle}</h1>
        <button
          onClick={() => navigate("/general-updates")}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 text-nowrap mr-5"
        >
          ← Back to General Updates
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 mx-5 mt-4">
          {error}
        </div>
      )}

      <div className="space-y-4 flex-1 min-h-0 mx-5">
        {!isNew && (
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => onTabChange("details")}
                className={cn(
                  "py-2 px-1 border-b-2 text-sm",
                  selectedTab === "details"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                )}
              >
                General Update Details
              </button>
              <button
                onClick={() => onTabChange("content")}
                className={cn(
                  "py-2 px-1 border-b-2 text-sm",
                  selectedTab === "content"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                )}
              >
                Content
              </button>
            </nav>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pb-6">
          {(isNew || selectedTab === "details") && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {formContent}
            </form>
          )}

          {!isNew &&
            selectedTab === "content" &&
            update &&
            renderContentTab(update)}
        </div>
      </div>
    </div>
  );
};

export default GeneralUpdatePage;
