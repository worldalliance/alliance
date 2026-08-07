import {
  displayOnlyToFormSchema,
  formSchemaToDisplayOnly,
  readDisplayOnlySchema,
  readDisplayOnlySchemaError,
} from "@alliance/common/forms/display-only-schema";
import { R } from "@alliance/common/result";
import {
  actionsCreateGeneralUpdateAdmin,
  actionsFindOneGeneralUpdateAdmin,
  actionsSuitesAdmin,
  ActionSuiteDto,
  actionsUpdateGeneralUpdateAdmin,
  CreateGeneralUpdateDto,
  GeneralUpdateAdminDto,
  UpdateGeneralUpdateDto,
  userMembers,
} from "@alliance/shared/client";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { cn } from "@alliance/shared/styles/util";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { FormBuilder, type DisplayOnlySave } from "../components/FormBuilder";

const FormSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="border border-gray-200 rounded-lg bg-white">
    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

type Tab = "details" | "content";

const notDisplayOnlyMessage = (issues: string[]) =>
  `General updates can only hold display-only content — ${issues.join("; ")}`;

type GeneralUpdateForm = {
  name: string;
  startDate: string;
  endDate: string;
  useManualCohort: boolean;
  manualCohortUserIds: number[];
  tagIds: string[];
  suiteIds: number[];
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = (searchParams.get("tab") as Tab) ?? "details";

  const isNew = !idParam || idParam === "new";
  const id = !isNew && idParam ? parseInt(idParam, 10) : null;

  const [update, setUpdate] = useState<GeneralUpdateAdminDto | null>(null);
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<GeneralUpdateForm>(emptyForm);

  const { tags: availableTags, isLoading: tagsLoading } = useTagsAdmin();
  const [availableSuites, setAvailableSuites] = useState<ActionSuiteDto[]>([]);
  const [suitesLoading, setSuitesLoading] = useState<boolean>(true);
  const [availableUsers, setAvailableUsers] = useState<UserSelectUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isNew) return;
    const suiteIdParam = searchParams.get("suiteId");
    if (!suiteIdParam) return;
    const suiteId = parseInt(suiteIdParam, 10);
    if (isNaN(suiteId)) return;
    setForm((prev) =>
      prev.suiteIds.includes(suiteId)
        ? prev
        : { ...prev, suiteIds: [...prev.suiteIds, suiteId] },
    );
  }, [isNew, searchParams]);

  const onTabChange = useCallback(
    (t: Tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", t);
        return next;
      });
    },
    [setSearchParams],
  );

  // Load suites, users
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await actionsSuitesAdmin();
        if (!cancelled && response.data) setAvailableSuites(response.data);
      } catch (err) {
        console.error("Failed to load suites:", err);
      } finally {
        if (!cancelled) setSuitesLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await userMembers();
        if (!cancelled && response.data) {
          setAvailableUsers(
            response.data.map<UserSelectUser>((user) => ({
              id: user.id,
              name: user.displayName,
              profilePicture: user.profilePicture,
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load general update when editing
  useEffect(() => {
    if (isNew || id == null || isNaN(id)) {
      if (!isNew && idParam) setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await actionsFindOneGeneralUpdateAdmin({
          path: { id },
        });

        if (cancelled) return;
        const data = response.data;
        if (!data) {
          setError("General update not found");
          setLoading(false);
          return;
        }
        setUpdate(data);
        setForm({
          name: data.name,
          startDate: data.startDate
            ? new Date(data.startDate).toISOString().slice(0, 16)
            : "",
          endDate: data.endDate
            ? new Date(data.endDate).toISOString().slice(0, 16)
            : "",
          useManualCohort: data.useManualCohort,
          manualCohortUserIds: data.manualCohortUserIds ?? [],
          tagIds: data.tags?.map((t) => t.id) ?? [],
          suiteIds: data.suites?.map((s) => s.id) ?? [],
        });
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load general update");
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, idParam]);

  const hasSuites = form.suiteIds.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      try {
        if (isNew) {
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
          };
          const response = await actionsCreateGeneralUpdateAdmin({ body });
          if (!response.data) throw new Error("Failed to create");
          navigate(`/general-updates/${response.data.id}`);
        } else if (id != null && update) {
          const body: UpdateGeneralUpdateDto = {
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
          };
          const response = await actionsUpdateGeneralUpdateAdmin({
            path: { id },
            body,
          });
          if (response.data) setUpdate(response.data);
          else throw new Error("Update failed");
        }
      } catch (err) {
        setError("Failed to save general update");
        console.error(err);
      } finally {
        setSaving(false);
      }
    },
    [isNew, id, update, form, hasSuites, navigate],
  );

  const handleToggleTag = useCallback((tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((t) => t !== tagId)
        : [...prev.tagIds, tagId],
    }));
  }, []);

  const handleAddSuite = useCallback((suiteId: number) => {
    setForm((prev) =>
      prev.suiteIds.includes(suiteId)
        ? prev
        : { ...prev, suiteIds: [...prev.suiteIds, suiteId] },
    );
  }, []);

  const handleRemoveSuite = useCallback((suiteId: number) => {
    setForm((prev) => ({
      ...prev,
      suiteIds: prev.suiteIds.filter((s) => s !== suiteId),
    }));
  }, []);

  const handleManualCohortChange = useCallback((ids: number[]) => {
    setForm((prev) => ({
      ...prev,
      manualCohortUserIds: ids,
    }));
  }, []);

  const handleSaveSchema = useCallback<DisplayOnlySave>(
    async ({ schema, expectedSnapshotId }) => {
      if (id == null) throw new Error("Missing general update id");
      if (expectedSnapshotId === null) {
        throw new Error("Missing the snapshot this edit was built on");
      }
      const converted = formSchemaToDisplayOnly(schema);
      if (R.isFailure(converted)) {
        throw new Error(notDisplayOnlyMessage(converted.error));
      }
      const response = await actionsUpdateGeneralUpdateAdmin({
        path: { id },
        body: {
          schema: converted.value,
          expectedSchemaSnapshotId: expectedSnapshotId,
        },
      });

      if (response.response.status === 409) {
        const latest = await actionsFindOneGeneralUpdateAdmin({ path: { id } });
        const theirs = latest.data && readDisplayOnlySchema(latest.data.schema);
        if (!latest.data || !theirs) {
          throw new Error("This update was changed by someone else");
        }
        setUpdate(latest.data);
        return R.failure({
          theirs: displayOnlyToFormSchema(theirs, latest.data.name),
          theirsSnapshotId: latest.data.schemaSnapshotId,
        });
      }

      if (!response.data) {
        const rejected = readDisplayOnlySchemaError(response.error);
        if (rejected) throw new Error(notDisplayOnlyMessage(rejected));
        const message = response.error?.message;
        throw new Error(
          (Array.isArray(message) ? message.join("; ") : message) ??
            "Failed to save content",
        );
      }
      setUpdate(response.data);
      return R.success({ snapshotId: response.data.schemaSnapshotId });
    },
    [id],
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

      <FormSection
        title="Suites"
        description="Assign this general update to one or more suites. When assigned to a suite, the start and end dates are inherited from some action in the suite."
      >
        <div className="space-y-3">
          {form.suiteIds.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {form.suiteIds.map((suiteId) => {
                const suite = availableSuites.find((s) => s.id === suiteId);
                const name = suite?.name ?? `Suite #${suiteId}`;
                return (
                  <li key={suiteId}>
                    <button
                      type="button"
                      onClick={() => handleRemoveSuite(suiteId)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer"
                      aria-label={`Remove ${name}`}
                    >
                      {name}
                      <span aria-hidden className="text-gray-500">
                        <X className="w-4 h-4" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {suitesLoading ? (
            <p className="text-sm text-gray-500">Loading suites...</p>
          ) : availableSuites.length ? (
            <div className="flex items-center gap-2">
              <label htmlFor="add-suite" className="sr-only">
                Add suite
              </label>
              <select
                id="add-suite"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    handleAddSuite(Number(v));
                  }
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Add a suite...</option>
                {availableSuites
                  .filter((s) => !form.suiteIds.includes(s.id))
                  .map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      {suite.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suites available.</p>
          )}
        </div>
      </FormSection>

      {!hasSuites && (
        <FormSection
          title="Schedule"
          description="Set start and end dates manually when not using a suite."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date
              </label>
              <input
                type="datetime-local"
                id="startDate"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date
              </label>
              <input
                type="datetime-local"
                id="endDate"
                value={form.endDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              />
            </div>
          </div>
        </FormSection>
      )}

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

  if (loading) {
    return (
      <div className="p-8">
        <title>General Update - Admin</title>
        Loading general update...
      </div>
    );
  }

  if (error && !update && !isNew) {
    return (
      <div className="p-8">
        <title>General Update - Admin</title>
        <p className="text-red-500">{error}</p>
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
        initialSchema={displayOnlyToFormSchema(
          storedSchema,
          generalUpdate.name,
        )}
        initialSnapshotId={generalUpdate.schemaSnapshotId}
        title={generalUpdate.name}
        setFormId={() => {}}
        onSave={handleSaveSchema}
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
