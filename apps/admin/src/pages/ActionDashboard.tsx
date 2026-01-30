import type { Action, ActionSuite, Tag, TagDto } from "@alliance/shared/client";
import {
  ActionDto,
  actionsArchive,
  actionsCreate,
  actionsExportAction,
  actionsFindOneAdmin,
  actionsRemove,
  actionsSuites,
  actionsShareUrlStats,
  actionsUnarchive,
  actionsUpdate,
  CreateActionDto,
  FormDto,
  imagesUploadImage,
  tasksCreateForm,
  tasksGetForm,
  tasksListForms,
  userGetTags,
  userMembers,
} from "@alliance/shared/client";
import type { ShareUrlStatsDto } from "@alliance/shared/client/types.gen";
import { getApiUrl, getBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import Dropdown from "@alliance/sharedweb/ui/Dropdown";
import CopyIcon from "@alliance/sharedweb/ui/icons/CopyIcon";
import DatabaseIcon from "@alliance/sharedweb/ui/icons/DatabaseIcon";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckIcon,
  ListChecks,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import ActionForm from "../components/ActionForm";
import ActionUpdatesTab from "../components/ActionUpdatesTab";
import EventManagementTab from "../components/EventManagementTab";
import { FormBuilder } from "../components/FormBuilder";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { CardStyle } from "@alliance/shared/styles/card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";

// Status color mapping
export const getStatusColor = (status: ActionDto["status"]) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "planned":
      return "bg-blue-100 text-blue-800";
    case "gathering_commitments":
      return "bg-yellow-100 text-yellow-800";
    case "office_action":
      return "bg-orange-100 text-orange-800";
    case "member_action":
      return "bg-purple-100 text-purple-800";
    case "resolution":
      return "bg-indigo-100 text-indigo-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "abandoned":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// Format status for display
export const formatStatus = (status: string) => {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

type Tab = "overview" | "details" | "events" | "form" | "updates";

type ReadinessCheckItem = {
  id: string;
  label: string;
  isReady: boolean;
  fixTab: Tab;
};

const ActionDashboard: React.FC = () => {
  const { actionId: actionIdParam } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const isNew = actionIdParam === "new";
  const actionId = isNew ? null : parseInt(actionIdParam!);
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [availableForms, setAvailableForms] = useState<FormDto[]>([]);
  const [formsLoading, setFormsLoading] = useState<boolean>(true);
  const [availableTags, setAvailableTags] = useState<TagDto[]>([]);
  const [tagsLoading, setTagsLoading] = useState<boolean>(true);
  const [availableSuites, setAvailableSuites] = useState<ActionSuite[]>([]);
  const [suitesLoading, setSuitesLoading] = useState<boolean>(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserSelectUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [manualCohortUserIds, setManualCohortUserIds] = useState<number[]>([]);

  const [shareUrlStats, setShareUrlStats] = useState<ShareUrlStatsDto[]>([]);
  const [shareUrlStatsLoading, setShareUrlStatsLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTab = (searchParams.get("tab") as Tab) ?? "overview";

  const onTabChange = useCallback(
    (t: Tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", t);
        return next;
      });
    },
    [setSearchParams]
  );

  // Load available forms on component mount
  useEffect(() => {
    const loadForms = async () => {
      try {
        const response = await tasksListForms();
        if (response.data) {
          setAvailableForms(response.data);
        }
        setFormsLoading(false);
      } catch (err) {
        console.error("Failed to load forms:", err);
        setFormsLoading(false);
      }
    };
    loadForms();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSuites = async () => {
      try {
        const response = await actionsSuites();
        if (!cancelled && response.data) {
          setAvailableSuites(response.data);
        }
      } catch (err) {
        console.error("Failed to load suites:", err);
      } finally {
        if (!cancelled) {
          setSuitesLoading(false);
        }
      }
    };

    loadSuites();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTags = async () => {
      try {
        const response = await userGetTags();
        if (!cancelled && response.data) {
          setAvailableTags(response.data);
        }
      } catch (err) {
        console.error("Failed to load groups:", err);
      } finally {
        if (!cancelled) {
          setTagsLoading(false);
        }
      }
    };

    loadTags();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const response = await userMembers();
        if (!cancelled && response.data) {
          const mappedUsers = response.data.map<UserSelectUser>((user) => ({
            id: user.id,
            name: user.displayName,
            profilePicture: user.profilePicture,
          }));
          setAvailableUsers(mappedUsers);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const [form, setForm] = useState<CreateActionDto>({
    name: "",
    category: "",
    image: "",
    body: "",
    timeEstimate: 0,
    shortDescription: "",
    visibilityMode: "all_members",
    commitmentless: true,
    type: "Activity",
    preventCompletion: false,
    taskFormId: undefined,
    participatingTags: [],
    everyoneShouldComplete: false,
    shouldCompleteAfterDeadline: false,
    publicOnly: false,
    suiteId: undefined,
    optional: false,
    priority: 0,
    manualCohortUserIds: [],
    useManualCohort: false,
    authorIds: [],
  });

  // Reset form when switching to new action mode
  useEffect(() => {
    if (isNew) {
      setForm({
        name: "",
        category: "",
        image: "",
        body: "",
        timeEstimate: 0,
        shortDescription: "",
        visibilityMode: "all_members",
        commitmentless: true,
        type: "Activity",
        preventCompletion: false,
        taskFormId: undefined,
        participatingTags: [],
        shouldCompleteAfterDeadline: false,
        publicOnly: false,
        everyoneShouldComplete: false,
        suiteId: searchParams.get("suiteId")
          ? parseInt(searchParams.get("suiteId")!)
          : undefined,
        optional: false,
        priority: 0,
        manualCohortUserIds: [],
        useManualCohort: false,
        authorIds: [],
      });
      setImageKey(null);
      setImagePreview(null);
      setError(null);
      setSelectedTagIds([]);
      setManualCohortUserIds([]);
    }
  }, [isNew, searchParams]);

  const setTaskFormId = async (formId: number) => {
    setForm((prev) => ({ ...prev, taskFormId: formId }));
    if (actionId) {
      const response = await actionsUpdate({
        path: { id: actionId },
        body: { taskFormId: formId },
      });
      if (response.data) {
        setAction(response.data);
      } else {
        setError("Failed to update action form");
      }
    }
  };

  useEffect(() => {
    if (isNew || !actionId) {
      return;
    }

    const loadAction = async () => {
      try {
        const response = await actionsFindOneAdmin({
          path: { id: actionId },
        });
        const actionData = response.data;
        if (!actionData) {
          throw new Error("Action not found");
        }
        setAction(actionData);
        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          activities,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          usersCompleted,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          usersJoined,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          events,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          updates,
          suite,
          ...formData
        } = actionData;

        const manualCohortUserIds = actionData.manualCohortUserIds ?? [];
        const authors = actionData.authors ?? [];
        const authorIds = authors.map((user) => user.id);

        setForm({
          ...formData,
          taskFormId: actionData.taskFormId,
          participatingTags: actionData.participatingTags ?? [],
          suiteId: suite?.id,
          manualCohortUserIds,
          useManualCohort: actionData.useManualCohort ?? false,
          authorIds,
        });

        setSelectedTagIds(
          (actionData.participatingTags || []).map((tag) => tag.id)
        );
        setManualCohortUserIds(manualCohortUserIds);

        setImageKey(actionData.image ?? null);
        setImagePreview(actionData.image ?? null);

        setLoading(false);
      } catch (err) {
        setError("Failed to load action");
        setLoading(false);
        console.error(err);
      }
    };

    loadAction();
  }, [actionId, isNew, availableUsers]);

  // Load share URL stats for publicOnly actions
  useEffect(() => {
    if (!action || !action.publicOnly || !actionId) {
      setShareUrlStats([]);
      return;
    }

    const loadShareUrlStats = async () => {
      setShareUrlStatsLoading(true);
      try {
        const response = await actionsShareUrlStats({
          path: { actionId },
          query: { questionId: "field-1765411401186" },
        });
        if (response.data) {
          setShareUrlStats(response.data);
        }
      } catch (err) {
        console.error("Failed to load share URL stats:", err);
      } finally {
        setShareUrlStatsLoading(false);
      }
    };

    loadShareUrlStats();
  }, [action, actionId]);

  const handleActionCreated = useCallback(
    (action: ActionDto) => {
      navigate(`/actions/${action.id}`);
    },
    [navigate]
  );

  const handleDuplicate = useCallback(async () => {
    let taskFormId = form.taskFormId;
    if (taskFormId) {
      const taskForm = await tasksGetForm({
        path: { id: taskFormId },
      });
      if (taskForm.data) {
        const newTaskForm = await tasksCreateForm({
          body: {
            title: taskForm.data.title + " (Copy)",
            schema: taskForm.data.schema,
          },
        });
        taskFormId = newTaskForm.data?.id;
      }
    }

    const duplicateForm = {
      ...form,
      name: `${form.name} (Copy)`,
      taskFormId,
    };
    const response = await actionsCreate({
      body: duplicateForm,
    });
    const newAction = response.data;
    if (!newAction) {
      setError("Failed to duplicate action");
      return;
    }
    window.location.href = `/actions/${newAction.id}`;
  }, [form]);

  const handleActionDeleted = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        manualCohortUserIds:
          name === "useManualCohort" && !target.checked
            ? []
            : prev.manualCohortUserIds,
        [name]: target.checked,
      }));
      return;
    }

    if (name === "suiteId") {
      setForm((prev) => ({
        ...prev,
        suiteId: value === "" ? null : parseInt(value, 10),
      }));
      return;
    }

    // Handle numeric fields
    if (
      name === "commitmentThreshold" ||
      name === "donationThreshold" ||
      name === "donationAmount"
    ) {
      const numValue = value === "" ? null : parseFloat(value);
      setForm((prev) => ({
        ...prev,
        [name]: numValue,
      }));
    } else {
      setForm((prev) => {
        const newForm = {
          ...prev,
          [name]: value,
        };

        if (name === "type" && value === "Funding") {
          newForm.taskFormId = undefined;
        }

        return newForm;
      });
    }
  };

  const { confirm } = useToast();

  const handleArchive = useCallback(async () => {
    const confirmed =
      action?.archived ||
      (await confirm({
        title: "Confirm Archive",
        message: "Are you sure you want to archive this action?",
      }));
    if (confirmed && actionId) {
      if (action?.archived) {
        await actionsUnarchive({
          path: { id: actionId },
        });
      } else {
        await actionsArchive({
          path: { id: actionId },
        });
      }
      window.location.reload();
    }
  }, [actionId, action?.archived, confirm]);

  const handleTagsChange = useCallback((ids: string[]) => {
    setSelectedTagIds(ids);
    setForm((prev) => ({
      ...prev,
      participatingTags: ids.map((id) => ({ id } as unknown as Tag)),
    }));
  }, []);

  const handleManualCohortChange = useCallback((ids: number[]) => {
    setManualCohortUserIds(ids);
    setForm((prev) => ({
      ...prev,
      manualCohortUserIds: ids,
    }));
  }, []);

  const handleAuthorsChange = useCallback((ids: number[]) => {
    setForm((prev) => ({
      ...prev,
      authorIds: ids,
    }));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        setImagePreview(reader.result as string);

        const uploadResp = await imagesUploadImage({
          body: { file: reader.result as string },
        });
        if (uploadResp.data) {
          console.log(uploadResp.data);
          setImagePreview(uploadResp.data.url);
          setImageKey(uploadResp.data.key);
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const formData = {
        ...form,
        participatingTags: selectedTagIds.map(
          (id) => ({ id } as unknown as Tag)
        ),
        image: imageKey ?? undefined,
        manualCohortUserIds: form.useManualCohort ? manualCohortUserIds : [],
      };

      if (isNew) {
        const response = await actionsCreate({
          body: formData,
        });
        const newAction = response.data;
        if (!newAction) {
          throw new Error("Failed to create action");
        }

        handleActionCreated(newAction);
      } else if (actionId) {
        const response = await actionsUpdate({
          path: { id: actionId },
          body: formData,
        });
        const updatedAction = response.data;
        if (!updatedAction) {
          throw new Error("Failed to update action");
        }
        // Reload the action to get updated data
        const reloadResponse = await actionsFindOneAdmin({
          path: { id: actionId },
        });
        if (reloadResponse.data) {
          setAction(reloadResponse.data);
        }
      }
      setSaving(false);
    } catch (err) {
      setError("Failed to save action");
      setSaving(false);
      console.error(err);
    }
  };

  const [exportActionOpen, setExportActionOpen] = useState(false);
  const [exportActionEvents, setExportActionEvents] = useState(false);
  const [exportActionTaskForm, setExportActionTaskForm] = useState(true);
  const [exportActionSuite, setExportActionSuite] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const handleExportActionOpen = async () => {
    setExportActionOpen((prev) => !prev);
  };

  const handleExportAction = async () => {
    if (actionId) {
      const response = await actionsExportAction({
        path: { id: actionId },
        query: {
          events: exportActionEvents,
          reminders: false,
          taskForm: exportActionTaskForm,
          suite: exportActionSuite,
        },
      });
      if (response.data) {
        navigator.clipboard.writeText(JSON.stringify(response.data));
        setJsonCopied(true);
        setTimeout(() => {
          setJsonCopied(false);
          setExportActionOpen(false);
        }, 2000);
      }
    }
  };

  const handleDelete = async () => {
    if (isNew || !actionId) return;

    if (
      window.confirm(
        "Are you sure you want to delete this action? This cannot be undone."
      )
    ) {
      try {
        setLoading(true);
        const response = await actionsRemove({
          path: { id: actionId },
        });
        if (response.error) {
          throw new Error("Failed to delete action");
        }
        handleActionDeleted();
      } catch (err) {
        setError("Failed to delete action");
        setLoading(false);
        console.error(err);
      }
    }
  };

  const baseUrl = getApiUrl();

  const tabData: { key: Tab; label: string }[] = [
    { key: "overview", label: "Status Overview" },
    { key: "details", label: "Action Details" },
    { key: "events", label: "Event Management" },
    { key: "updates", label: "Updates" },
    ...(action?.type === "Activity"
      ? [{ key: "form" as Tab, label: "Task Form" }]
      : []),
  ];

  const availableTabs = tabData.map((tab) => tab.key);
  const activeTab = availableTabs.includes(selectedTab)
    ? selectedTab
    : tabData[0].key;

  const currentEventId = action?.events
    ?.filter((event) => new Date(event.date).getTime() < new Date().getTime())
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0]?.id;

  const readinessChecklist = useMemo<ReadinessCheckItem[]>(() => {
    if (!action) {
      return [];
    }

    const trimmedShortDescription = action.shortDescription?.trim() ?? "";
    const trimmedBody = action.body?.trim() ?? "";
    const partOfSuite = Boolean(action.suite?.id);
    const thumbnail = action.squareThumbnailImage?.trim() ?? "";
    const hasThumbnail = thumbnail.length > 0;

    const items: ReadinessCheckItem[] = [
      {
        id: "shortDescription",
        label: "Short description",
        isReady: trimmedShortDescription.length > 0,
        fixTab: "details",
      },
      {
        id: "body",
        label: "Full body content",
        isReady: trimmedBody.length > 0,
        fixTab: "details",
      },
      {
        id: "thumbnail",
        label: "Has a thumbnail",
        isReady: hasThumbnail,
        fixTab: "details",
      },
      {
        id: "suite",
        label: "Part of a suite",
        isReady: partOfSuite,
        fixTab: "details",
      },
      {
        id: "tags",
        label: "Participating tags set",
        isReady: (action.participatingTags?.length ?? 0) > 0,
        fixTab: "details",
      },
      {
        id: "authors",
        label: "Action authors set",
        isReady: (action.authors?.length ?? 0) > 0,
        fixTab: "details",
      },
    ];

    if (action.type === "Activity") {
      items.push({
        id: "taskForm",
        label: "Task form linked",
        isReady: Boolean(action.taskFormId),
        fixTab: "form",
      });
    }

    return items;
  }, [action]);

  const readinessReadyCount = readinessChecklist.filter(
    (item) => item.isReady
  ).length;
  const readinessTotalCount = readinessChecklist.length;
  const readinessComplete =
    readinessTotalCount > 0 && readinessReadyCount === readinessTotalCount;

  const handleReadinessItemFix = useCallback(
    (item: ReadinessCheckItem) => {
      onTabChange(item.fixTab);
    },
    [onTabChange]
  );

  if (loading) {
    return <div className="p-8">Loading action...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <title>Action Dashboard</title>
      <div className="flex justify-between items-center mb-2">
        <div className="p-5 pb-0 flex flex-row justify-between w-full">
          <div className="flex flex-row gap-x-2 ">
            <div className="flex flex-row gap-x-2 items-center">
              {action?.archived && (
                <span className="px-2 py-1 rounded-sm bg-red-200">
                  Archived
                </span>
              )}
            </div>
            <h1 className="text-[#111] text-[16pt] font-bold">
              {isNew ? "Create New Action" : `${action?.name}`}
            </h1>
          </div>
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 text-nowrap mr-5"
          >
            ← Back
          </button>
        </div>
      </div>
      <p className="p-2 border border-gray-200 mb-4 mx-5">
        Please see{" "}
        <a
          className="text-green underline"
          href="https://www.notion.so/Action-public-preparation-guide-28b6915bb8fa80f19306f016ff13ba5d?source=copy_link"
          target="_blank"
          rel="noreferrer"
        >
          Action public preparation guide
        </a>
      </p>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isNew ? (
        // New Action Creation Form
        <div className="p-5">
          <ActionForm
            form={form}
            onInputChange={handleInputChange}
            onImageChange={handleImageChange}
            onSubmit={handleSubmit}
            saving={saving}
            imagePreview={imagePreview}
            isNew={true}
            onCancel={handleCancel}
            availableForms={availableForms}
            formsLoading={formsLoading}
            availableTags={availableTags}
            tagsLoading={tagsLoading}
            availableSuites={availableSuites}
            suitesLoading={suitesLoading}
            selectedTagIds={selectedTagIds}
            onTagsChange={handleTagsChange}
            availableUsers={availableUsers}
            usersLoading={usersLoading}
            manualCohortUserIds={manualCohortUserIds}
            onManualCohortChange={handleManualCohortChange}
            authorIds={form.authorIds ?? []}
            onAuthorsChange={handleAuthorsChange}
          />
        </div>
      ) : (
        // Existing Action Dashboard
        <div className="space-y-4 flex-1 min-h-0 mx-5">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabData.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`py-2 px-1 border-b-2 text-sm ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                key="responses"
                onClick={() =>
                  navigate(`/forms/${action?.taskFormId}/responses`)
                }
                className="py-2 px-1 border-b-2 text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              >
                Responses
              </button>
              <a
                href={getBaseUrl() + `/actions/${action?.id}`}
                target="_blank"
                rel="noreferrer"
                className={`py-2 px-1 border-b-2 font-medium text-sm ${"border-transparent text-blue-500 hover:text-blue-600 hover:border-blue-300"}`}
              >
                View Action Page →
              </a>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "overview" && action && (
              <div className="space-y-4 pb-4">
                {/* Current Status */}
                <div className="flex flex-row gap-2 flex-wrap">
                  {action.suite !== undefined && (
                    <Button
                      onClick={() => {
                        navigate(`/suites/${action.suite!.id}`);
                      }}
                      color={ButtonColor.White}
                      className="!px-3 !text-sm gap-x-1"
                    >
                      Open Suite
                    </Button>
                  )}
                  <Button
                    onClick={() =>
                      window.open(
                        `/database?table=action&id=${action.id}`,
                        "_blank"
                      )
                    }
                    color={ButtonColor.White}
                    className="!px-3 !text-sm gap-x-1"
                  >
                    <DatabaseIcon size="large" />
                    Edit in Database
                  </Button>
                  <Button
                    onClick={() => handleDuplicate()}
                    color={ButtonColor.White}
                    className="!px-3 !text-sm gap-x-1"
                  >
                    <CopyIcon size="large" />
                    Duplicate Action
                  </Button>
                  <div className="relative">
                    <Button
                      onClick={handleExportActionOpen}
                      color={ButtonColor.White}
                      className="!px-3 !text-sm gap-x-1 disabled"
                    >
                      Export JSON
                    </Button>
                    {exportActionOpen && (
                      <Dropdown
                        isOpen={exportActionOpen}
                        className="absolute top-[100%] right-0 gap-y-2 min-w-[150px]"
                      >
                        <div className="flex flex-col gap-y-2">
                          <LargeCheckbox
                            label="Events"
                            checked={exportActionEvents}
                            onChange={(checked) =>
                              setExportActionEvents(checked)
                            }
                          />
                          <LargeCheckbox
                            label="Task Form"
                            checked={exportActionTaskForm}
                            onChange={(checked) =>
                              setExportActionTaskForm(checked)
                            }
                          />
                          <LargeCheckbox
                            label="Suite"
                            checked={exportActionSuite}
                            onChange={(checked) =>
                              setExportActionSuite(checked)
                            }
                          />
                        </div>
                        <Button
                          color={ButtonColor.Black}
                          onClick={handleExportAction}
                          disabled={jsonCopied}
                          className="text-nowrap"
                        >
                          {jsonCopied ? "in clipboard" : "Export JSON"}
                        </Button>
                      </Dropdown>
                    )}
                  </div>
                  <Button
                    onClick={() => handleArchive()}
                    color={ButtonColor.RedOutline}
                    className="!px-3 !text-sm gap-x-1 bg-white hover:bg-red-50"
                  >
                    {action.archived ? "Unarchive Action" : "Archive Action"}
                  </Button>
                </div>
                {readinessTotalCount > 0 && (
                  <Card style={CardStyle.White}>
                    <div className="flex flex-col gap-y-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <ListChecks
                          className="mt-0.5 h-5 w-5 text-green"
                          strokeWidth={3}
                        />
                        <h2 className="text-lg font-semibold">
                          Recommendations
                        </h2>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          readinessComplete
                            ? "bg-green/20 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {readinessReadyCount}/{readinessTotalCount} ready
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {readinessChecklist.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            {item.isReady ? (
                              <CheckIcon
                                className="h-5 w-5 text-green"
                                strokeWidth={3}
                              />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {item.label}
                              </p>
                            </div>
                          </div>
                          {!item.isReady && (
                            <button
                              type="button"
                              className="inline-flex items-center text-sm font-medium text-blue-500 hover:text-blue-700"
                              onClick={() => handleReadinessItemFix(item)}
                            >
                              Fix
                              <ArrowUpRight className="ml-1 h-4 w-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                <Card style={CardStyle.White}>
                  <h2 className="text-lg font-semibold mb-0">
                    Current Status:{" "}
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full cursor-pointer text-[14px] font-normal ${getStatusColor(
                        action.status
                      )}`}
                      onClick={() => {
                        onTabChange("events");
                      }}
                    >
                      {formatStatus(action.status)}
                    </span>
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        <strong>Users Completed:</strong>{" "}
                        {action.usersCompleted}
                      </div>
                      {action.type === "Funding" && (
                        <>
                          {action.donationAmount && (
                            <div className="text-sm text-gray-600">
                              <strong>Suggested Donation:</strong> $
                              {action.donationAmount / 100}
                            </div>
                          )}
                        </>
                      )}
                      {action.commitmentThreshold && (
                        <div className="text-sm text-gray-600">
                          <strong>Commitment Threshold:</strong>{" "}
                          {action.commitmentThreshold}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        <strong>Action ID:</strong> {action.id}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Events Timeline */}
                <Card style={CardStyle.White}>
                  <h2 className="text-lg font-semibold mb-4">
                    Status Timeline
                  </h2>
                  <div className="space-y-3">
                    {action.events && action.events.length > 0 ? (
                      action.events
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime()
                        )
                        .map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center space-x-3"
                          >
                            <div className="flex-shrink-0">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  event.id === currentEventId
                                    ? "bg-blue-500"
                                    : "bg-gray-300"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                <span className="">{event.title}</span>
                                <span
                                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${getStatusColor(
                                    event.newStatus
                                  )}`}
                                >
                                  {formatStatus(event.newStatus)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(event.date).toLocaleString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZoneName: "short",
                                  }
                                )}
                              </div>
                              {event.description && (
                                <div className="text-xs text-gray-600 mt-1">
                                  {event.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm text-gray-500">
                        No events yet. This action is in Draft status by
                        default.
                      </div>
                    )}
                  </div>
                </Card>

                {/* Share URL Stats - only for publicOnly actions */}
                {action.publicOnly && (
                  <Card style={CardStyle.White}>
                    <h2 className="font-semibold mb-4">
                      Invite Stats (
                      {shareUrlStats.reduce((sum, s) => sum + s.inviteCount, 0)}{" "}
                      total public submissions)
                    </h2>
                    {shareUrlStatsLoading ? (
                      <div className="text-sm text-gray-500">Loading...</div>
                    ) : shareUrlStats.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-600">
                                Member
                              </th>
                              <th className="text-right py-2 px-3 font-medium text-gray-600">
                                Form submissions
                              </th>
                              <th className="text-right py-2 px-3 font-medium text-gray-600">
                                Interested in joining
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {shareUrlStats.map((stat) => (
                              <tr
                                key={stat.sid}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    <ProfileImage
                                      pfp={stat.user.profilePicture}
                                      size="small"
                                    />
                                    <span className="font-medium text-gray-800">
                                      {stat.user.displayName}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-medium">
                                  {stat.inviteCount}
                                </td>
                                <td className="py-2 px-3 text-right font-medium">
                                  {stat.yesCount}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        No invites yet.
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}

            {activeTab === "details" && (
              <ActionForm
                form={form}
                onInputChange={handleInputChange}
                onImageChange={handleImageChange}
                onSubmit={handleSubmit}
                saving={saving}
                imagePreview={imagePreview}
                isNew={false}
                actionId={action?.id}
                onDelete={handleDelete}
                baseUrl={baseUrl}
                availableForms={availableForms}
                formsLoading={formsLoading}
                availableTags={availableTags}
                tagsLoading={tagsLoading}
                availableSuites={availableSuites}
                suitesLoading={suitesLoading}
                selectedTagIds={selectedTagIds}
                onTagsChange={handleTagsChange}
                availableUsers={availableUsers}
                usersLoading={usersLoading}
                manualCohortUserIds={manualCohortUserIds}
                onManualCohortChange={handleManualCohortChange}
                authorIds={form.authorIds ?? []}
                onAuthorsChange={handleAuthorsChange}
              />
            )}
            {activeTab === "form" && action && (
              <FormBuilder
                formId={action.taskFormId}
                setFormId={setTaskFormId}
                actionName={action.name}
              />
            )}

            {activeTab === "events" && action && (
              <EventManagementTab action={action} setAction={setAction} />
            )}

            {activeTab === "updates" && action && (
              <ActionUpdatesTab
                actionId={action.id}
                updates={action.updates ?? []}
                setUpdates={(updates) => setAction({ ...action, updates })}
                events={action.events ?? []}
                availableTags={availableTags}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionDashboard;
