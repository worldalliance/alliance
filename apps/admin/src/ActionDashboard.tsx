import React, { useEffect, useState } from "react";
import Card, { CardStyle } from "./Card";
import ActionForm from "./components/ActionForm";
import {
  CreateActionDto,
  ActionDto,
  CreateActionEventDto,
  ActionStatus,
} from "@alliance/shared/client";
import {
  actionsCreate,
  actionsFindOne,
  actionsRemove,
  actionsUpdate,
  actionsAddEvent,
  imagesUploadImage,
} from "@alliance/shared/client";
import { getApiUrl } from "./config";

// Status color mapping
const getStatusColor = (status: ActionDto["status"]) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "upcoming":
      return "bg-blue-100 text-blue-800";
    case "gathering_commitments":
      return "bg-yellow-100 text-yellow-800";
    case "commitments_reached":
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
const formatStatus = (status: string) => {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Status options for event creation
const statusOptions: Record<ActionStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  gathering_commitments: "Gathering Commitments",
  commitments_reached: "Commitments Reached",
  member_action: "Member Action",
  resolution: "Resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

interface ActionDashboardProps {
  actionId: string;
  isNew?: boolean;
  onActionCreated?: (action: ActionDto) => void;
  onActionUpdated?: (action: ActionDto) => void;
  onActionDeleted?: () => void;
  onCancel?: () => void;
}

type Tab = "overview" | "details" | "events";

const ActionDashboard: React.FC<ActionDashboardProps> = ({
  actionId,
  isNew = false,
  onActionCreated,
  onActionUpdated,
  onActionDeleted,
  onCancel,
}) => {
  const [action, setAction] = useState<ActionDto | null>(null);
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [form, setForm] = useState<CreateActionDto>({
    name: "",
    category: "",
    image: "",
    body: "",
    timeEstimate: "",
    shortDescription: "",
    type: "Activity",
  });

  // Event creation form state
  const [eventForm, setEventForm] = useState<CreateActionEventDto>({
    title: "",
    description: "",
    newStatus: "gathering_commitments",
    date: new Date().toISOString().slice(0, 16),
    showInTimeline: true,
    sendNotifsTo: "all",
  });

  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);

  // Reset form when switching to new action mode
  useEffect(() => {
    if (isNew) {
      setForm({
        name: "",
        category: "",
        image: "",
        body: "",
        timeEstimate: "",
        shortDescription: "",
        type: "Activity",
      });
      setImageFile(null);
      setImagePreview(null);
      setError(null);
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew) {
      return;
    }

    const loadAction = async () => {
      try {
        const response = await actionsFindOne({
          path: { id: parseInt(actionId) },
        });
        const actionData = response.data;
        if (!actionData) {
          throw new Error("Action not found");
        }
        setAction(actionData);
        setForm({
          ...actionData,
        });

        setLoading(false);
      } catch (err) {
        setError("Failed to load action");
        setLoading(false);
        console.error(err);
      }
    };

    loadAction();
  }, [actionId, isNew]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

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

        // Clear taskContents when type changes to Funding
        if (name === "type" && value === "Funding") {
          newForm.taskContents = undefined;
        }

        return newForm;
      });
    }
  };

  const handleEventInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setEventForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploadingImage(true);
      setError(null);

      const response = await imagesUploadImage({
        body: { image: imageFile },
      });

      if (!response.data) {
        throw new Error("Failed to upload image");
      }
      return response.data.filename;
    } catch (err) {
      console.error("Error uploading image:", err);
      setError("Failed to upload image. Please try again.");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let imageFilename = null;
      if (imageFile) {
        imageFilename = await uploadImage();
        if (!imageFilename) {
          throw new Error("Failed to upload image");
        }
      }

      const formData = {
        ...form,
        ...(imageFilename && { image: imageFilename }),
      };

      if (isNew) {
        const response = await actionsCreate({
          body: formData,
        });
        const newAction = response.data;
        if (!newAction) {
          throw new Error("Failed to create action");
        }
        if (onActionCreated) {
          onActionCreated(newAction);
        }
      } else {
        const response = await actionsUpdate({
          path: { id: parseInt(actionId) },
          body: formData,
        });
        const updatedAction = response.data;
        if (!updatedAction) {
          throw new Error("Failed to update action");
        }
        // Reload the action to get updated data
        const reloadResponse = await actionsFindOne({
          path: { id: parseInt(actionId) },
        });
        if (reloadResponse.data) {
          setAction(reloadResponse.data);
          if (onActionUpdated) {
            onActionUpdated(reloadResponse.data);
          }
        }
      }
      setSaving(false);
    } catch (err) {
      setError("Failed to save action");
      setSaving(false);
      console.error(err);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;

    setCreatingEvent(true);

    try {
      const eventData = {
        ...eventForm,
        date: new Date(eventForm.date).toISOString(),
      };

      const response = await actionsAddEvent({
        path: { id: parseInt(actionId) },
        body: eventData,
      });

      if (response.data) {
        setAction(response.data);
        if (onActionUpdated) {
          onActionUpdated(response.data);
        }
        // Reset form
        setEventForm({
          title: "",
          description: "",
          newStatus: "gathering_commitments",
          date: new Date().toISOString().slice(0, 16),
          showInTimeline: true,
          sendNotifsTo: "all",
        });
      } else {
        setError("Failed to add event");
      }
    } catch (err) {
      setError("Failed to add event");
      console.error(err);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;

    if (
      window.confirm(
        "Are you sure you want to delete this action? This cannot be undone."
      )
    ) {
      try {
        setLoading(true);
        const response = await actionsRemove({
          path: { id: parseInt(actionId) },
        });
        if (response.error) {
          throw new Error("Failed to delete action");
        }
        if (onActionDeleted) {
          onActionDeleted();
        }
      } catch (err) {
        setError("Failed to delete action");
        setLoading(false);
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="p-8">Loading action...</div>;
  }

  const baseUrl = getApiUrl();

  const tabData: { key: Tab; label: string }[] = [
    { key: "overview", label: "Status Overview" },
    { key: "details", label: "Action Details" },
    { key: "events", label: "Event Management" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-[#111] text-[16pt] font-bold">
          {isNew ? "Create New Action" : `Action: ${action?.name}`}
        </h1>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 text-nowrap"
          >
            ← Back
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isNew ? (
        // New Action Creation Form
        <Card style={CardStyle.White}>
          <ActionForm
            form={form}
            onInputChange={handleInputChange}
            onImageChange={handleImageChange}
            onSubmit={handleSubmit}
            saving={saving}
            uploadingImage={uploadingImage}
            imagePreview={imagePreview}
            isNew={true}
            onCancel={onCancel}
          />
        </Card>
      ) : (
        // Existing Action Dashboard
        <div className="space-y-4 flex-1 min-h-0">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabData.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "overview" && action && (
              <div className="space-y-4">
                {/* Current Status */}
                <Card style={CardStyle.White}>
                  <h2 className="text-lg font-semibold mb-0">
                    Current Status:{" "}
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full cursor-pointer text-[14px] font-medium ${getStatusColor(
                        action.status
                      )}`}
                      onClick={() => {
                        setActiveTab("events");
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
                      {action.type === "Funding" ? (
                        <>
                          {action.donationThreshold && (
                            <div className="text-sm text-gray-600">
                              <strong>Donation Threshold:</strong> $
                              {(action.donationThreshold || 0) / 100}
                            </div>
                          )}
                          {action.donationAmount && (
                            <div className="text-sm text-gray-600">
                              <strong>Suggested Donation:</strong> $
                              {action.donationAmount / 100}
                            </div>
                          )}
                        </>
                      ) : (
                        action.commitmentThreshold && (
                          <div className="text-sm text-gray-600">
                            <strong>Commitment Threshold:</strong>{" "}
                            {action.commitmentThreshold}
                          </div>
                        )
                      )}
                      <div className="text-sm text-gray-600">
                        <strong>Action ID:</strong> {action.id}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() =>
                          window.open(
                            `/database?table=action&id=${action.id}`,
                            "_blank"
                          )
                        }
                        className="inline-flex cursor-pointer items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path>
                          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"></path>
                        </svg>
                        Edit in Database
                      </button>
                    </div>

                    {action.image && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Action Image:
                        </p>
                        <img
                          src={`${baseUrl}/images/${action.image}`}
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
                        .map((event, index) => (
                          <div
                            key={event.id}
                            className="flex items-center space-x-3"
                          >
                            <div className="flex-shrink-0">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  index === 0 ? "bg-blue-500" : "bg-gray-300"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                <span className="font-medium">
                                  {event.title}
                                </span>
                                <span
                                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                    event.newStatus
                                  )}`}
                                >
                                  {formatStatus(event.newStatus)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(event.date).toLocaleString()}
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
              <Card style={CardStyle.White}>
                <ActionForm
                  form={form}
                  onInputChange={handleInputChange}
                  onImageChange={handleImageChange}
                  onSubmit={handleSubmit}
                  saving={saving}
                  uploadingImage={uploadingImage}
                  imagePreview={imagePreview}
                  isNew={false}
                  onDelete={handleDelete}
                  baseUrl={baseUrl}
                />
              </Card>
            )}

            {activeTab === "events" && action && (
              <div className="space-y-4">
                {/* Add New Event */}
                <Card style={CardStyle.White}>
                  <h2 className="text-lg font-semibold mb-4">Add New Event</h2>
                  <form onSubmit={handleAddEvent} className="space-y-4">
                    <div>
                      <label
                        htmlFor="eventTitle"
                        className="block font-medium text-gray-700 mb-1"
                      >
                        Event Title *
                      </label>
                      <input
                        type="text"
                        id="eventTitle"
                        name="title"
                        value={eventForm.title}
                        onChange={handleEventInputChange}
                        required
                        placeholder="e.g., Launch Event, Commitments Reached"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="eventDescription"
                        className="block font-medium text-gray-700 mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="eventDescription"
                        name="description"
                        value={eventForm.description}
                        onChange={handleEventInputChange}
                        rows={2}
                        placeholder="Describe what happened or what this event represents"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="newStatus"
                          className="block font-medium text-gray-700 mb-1"
                        >
                          New Status *
                        </label>
                        <select
                          id="newStatus"
                          name="newStatus"
                          value={eventForm.newStatus}
                          onChange={handleEventInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(statusOptions).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="eventDate"
                          className="block font-medium text-gray-700 mb-1"
                        >
                          Event Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          id="eventDate"
                          name="date"
                          value={eventForm.date}
                          onChange={handleEventInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="sendNotifsTo"
                          className="block font-medium text-gray-700 mb-1"
                        >
                          Send Notifications To
                        </label>
                        <select
                          id="sendNotifsTo"
                          name="sendNotifsTo"
                          value={eventForm.sendNotifsTo}
                          onChange={handleEventInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">All Users</option>
                          <option value="joined">Joined Users Only</option>
                          <option value="none">No Notifications</option>
                        </select>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showInTimeline"
                          name="showInTimeline"
                          checked={eventForm.showInTimeline}
                          onChange={handleEventInputChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-10"
                        />
                        <label
                          htmlFor="showInTimeline"
                          className="ml-2 block text-sm text-gray-700"
                        >
                          Show in public timeline
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creatingEvent}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {creatingEvent ? "Adding Event..." : "Add Event"}
                    </button>
                  </form>
                </Card>

                {/* All Events List */}
                <Card style={CardStyle.White}>
                  <h2 className="text-lg font-semibold mb-4">All Events</h2>
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
                            className="border border-gray-200 rounded-lg p-3"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-medium text-gray-900 text-sm">
                                {event.title}
                              </h3>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                  event.newStatus
                                )}`}
                              >
                                {formatStatus(event.newStatus)}
                              </span>
                            </div>

                            {event.description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {event.description}
                              </p>
                            )}

                            <div className="text-xs text-gray-500 space-y-1">
                              <div>
                                Date: {new Date(event.date).toLocaleString()}
                              </div>
                              <div>
                                Notifications: {event.sendNotifsTo} | Timeline:{" "}
                                {event.showInTimeline ? "Visible" : "Hidden"}
                              </div>
                            </div>

                            <div className="pt-2 mt-2 border-t border-gray-100">
                              <button
                                onClick={() =>
                                  window.open(
                                    `/database?table=action_event&id=${event.id}`,
                                    "_blank"
                                  )
                                }
                                className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                >
                                  <ellipse
                                    cx="12"
                                    cy="5"
                                    rx="9"
                                    ry="3"
                                  ></ellipse>
                                  <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path>
                                  <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"></path>
                                </svg>
                                Edit in Database
                              </button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No events created yet. Add an event to change the action
                        status.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionDashboard;
