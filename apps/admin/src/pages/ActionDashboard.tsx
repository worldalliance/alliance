import type { ActionSuite, Tag, TagDto, User } from "@alliance/shared/client";
import {
  ActionDto,
  actionsArchive,
  actionsCreate,
  actionsExportAction,
  actionsFindOne,
  actionsFindOneAdmin,
  actionsRemove,
  actionsSuites,
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
import { getApiUrl, getBaseUrl } from "@alliance/shared/lib/config";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import Dropdown from "@alliance/shared/ui/Dropdown";
import CopyIcon from "@alliance/shared/ui/icons/CopyIcon";
import DatabaseIcon from "@alliance/shared/ui/icons/DatabaseIcon";
import LargeCheckbox from "@alliance/shared/ui/LargeCheckbox";
import { UserSelectUser } from "@alliance/shared/ui/UserSelect";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import ActionForm from "../components/ActionForm";
import ActionUpdatesTab from "../components/ActionUpdatesTab";
import EventManagementTab from "../components/EventManagementTab";
import { FormBuilder } from "../components/FormBuilder";

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

const ActionDashboard: React.FC = () => {
  const { actionId: actionIdParam } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const isNew = actionIdParam === "new";
  const actionId = isNew ? null : parseInt(actionIdParam!);
  const [action, setAction] = useState<ActionDto | null>(null);
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
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserSelectUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [manualCohortUserIds, setManualCohortUserIds] = useState<number[]>([]);

  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTab = (searchParams.get("tab") as Tab) ?? "overview";

  const onTabChange = (t: Tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", t);
      return next;
    });
  };

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

  const [form, setForm] = useState<CreateActionDto & { taskFormId?: number }>({
    name: "",
    category: "",
    image: "",
    body: "",
    timeEstimate: 0,
    shortDescription: "",
    commitmentless: true,
    type: "Activity",
    preventCompletion: false,
    taskFormId: undefined,
    participatingTags: [],
    everyoneShouldComplete: false,
    publicOnly: false,
    suiteId: undefined,
    priority: 0,
    manualCohortUsers: [],
    useManualCohort: false,
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
        commitmentless: true,
        type: "Activity",
        preventCompletion: false,
        taskFormId: undefined,
        participatingTags: [],
        publicOnly: false,
        everyoneShouldComplete: false,
        suiteId: undefined,
        priority: 0,
        manualCohortUsers: [],
        useManualCohort: false,
      });
      setImageKey(null);
      setImagePreview(null);
      setError(null);
      setSelectedTagIds([]);
      setManualCohortUserIds([]);
    }
  }, [isNew]);

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

        const manualCohortUsers = actionData.manualCohortUsers ?? [];

        setForm({
          ...formData,
          taskFormId: actionData.taskFormId,
          participatingTags: actionData.participatingTags ?? [],
          suiteId: suite?.id,
          manualCohortUsers,
          useManualCohort: actionData.useManualCohort ?? false,
        });

        setSelectedTagIds(
          (actionData.participatingTags || []).map((tag) => tag.id)
        );
        setManualCohortUserIds(manualCohortUsers.map((user) => user.id));
        setAvailableUsers((prev) => {
          const existingIds = new Set(prev.map((user) => user.id));
          const manualUsers = manualCohortUsers.map<UserSelectUser>((user) => ({
            id: user.id,
            name:
              (user as unknown as { displayName?: string }).displayName ??
              user.name ??
              `User #${user.id}`,
            profilePicture: user.profilePicture,
          }));
          const additions = manualUsers.filter(
            (user) => !existingIds.has(user.id)
          );
          return additions.length ? [...prev, ...additions] : prev;
        });

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
  }, [actionId, isNew]);

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
      if (name === "useManualCohort" && !target.checked) {
        setManualCohortUserIds([]);
      }
      setForm((prev) => ({
        ...prev,
        manualCohortUsers:
          name === "useManualCohort" && !target.checked
            ? []
            : prev.manualCohortUsers,
        [name]: target.checked,
      }));
      return;
    }

    if (name === "suiteId") {
      setForm((prev) => ({
        ...prev,
        suiteId: value === "" ? undefined : parseInt(value, 10),
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

  const handleArchive = useCallback(async () => {
    if (actionId) {
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
  }, [actionId, action?.archived]);

  const handleTagsChange = useCallback((ids: number[]) => {
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
      manualCohortUsers: ids.map((id) => ({ id } as unknown as User)),
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
        manualCohortUsers: form.useManualCohort
          ? manualCohortUserIds.map((id) => ({ id } as unknown as User))
          : [],
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
        const reloadResponse = await actionsFindOne({
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

  const manualCohortSelectableUsers = useMemo(() => {
    const manualUsers =
      form.manualCohortUsers?.map<UserSelectUser>((user) => ({
        id: user.id,
        name: user.name,
        profilePicture: user.profilePicture,
      })) ?? [];

    const merged = new Map<number, UserSelectUser>();
    manualUsers.forEach((user) => merged.set(user.id, user));
    availableUsers.forEach((user) => merged.set(user.id, user));
    return Array.from(merged.values());
  }, [availableUsers, form.manualCohortUsers]);

  if (loading) {
    return <div className="p-8">Loading action...</div>;
  }
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
            availableUsers={manualCohortSelectableUsers}
            usersLoading={usersLoading}
            manualCohortUserIds={manualCohortUserIds}
            onManualCohortChange={handleManualCohortChange}
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
              <div className="space-y-4">
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
                        <strong>Users Joined:</strong> {action.usersJoined}
                      </div>
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

                    {action.image && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Action Image:
                        </p>
                        <img
                          src={action.image}
                          alt={action.name}
                          className="w-full max-w-sm h-auto rounded-md border border-gray-300"
                        />
                      </div>
                    )}
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
              </div>
            )}

            {activeTab === "details" && (
              <Card style={CardStyle.Grey}>
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
                  availableUsers={manualCohortSelectableUsers}
                  usersLoading={usersLoading}
                  manualCohortUserIds={manualCohortUserIds}
                  onManualCohortChange={handleManualCohortChange}
                />
              </Card>
            )}
            {activeTab === "form" && action && (
              <FormBuilder
                formId={action.taskFormId}
                setFormId={setTaskFormId}
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
