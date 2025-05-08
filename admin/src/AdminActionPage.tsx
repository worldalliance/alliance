import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card, { CardStyle } from "./Card";
import { CreateActionDto } from "./client/types.gen";
import {
  actionsCreate,
  actionsFindOne,
  actionsRemove,
  actionsUpdate,
  imagesUploadImage,
} from "./client/sdk.gen";
import { getApiUrl } from "./config";

const AdminActionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNewAction = id === "new";

  const [action, setAction] = useState<CreateActionDto | null>(null);
  const [loading, setLoading] = useState<boolean>(!isNewAction);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateActionDto>({
    name: "",
    category: "",
    whyJoin: "",
    description: "",
    status: "Draft",
    image: "",
  });

  useEffect(() => {
    if (isNewAction) {
      // Creating new action, no need to fetch
      return;
    }

    const loadAction = async () => {
      if (!id) {
        throw new Error("Action ID is required");
      }
      try {
        const response = await actionsFindOne({
          path: { id: id },
        });
        const actionData = response.data;
        if (!actionData) {
          throw new Error("Action not found");
        }
        setAction(actionData);
        console.log("actionData: ", actionData);
        setForm({
          name: actionData.name,
          category: actionData.category,
          whyJoin: actionData.whyJoin,
          description: actionData.description,
          status: actionData.status,
          image: actionData.image || "",
        });

        setLoading(false);
      } catch (err) {
        setError("Failed to load action");
        setLoading(false);
        console.error(err);
      }
    };

    loadAction();
  }, [id, isNewAction]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
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

      const formData = new FormData();
      formData.append("image", imageFile);

      console.log("formData: ", formData);

      const response = await imagesUploadImage({
        body: { image: imageFile },
      });

      if (!response.data) {
        throw new Error("Failed to upload image");
      }
      return response.data.filename as string;
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
      // Upload image first if one is selected
      let imageFilename = null;
      if (imageFile) {
        imageFilename = await uploadImage();
        if (!imageFilename) {
          throw new Error("Failed to upload image");
        }
      }

      // Create form data with image ID if available
      const formData = {
        ...form,
        ...(imageFilename && { image: imageFilename }),
      };

      if (isNewAction) {
        const response = await actionsCreate({
          body: formData,
        });
        const newAction = response.data;
        if (!newAction) {
          throw new Error("Failed to create action");
        }
        navigate(`/action/${newAction.id}`);
      } else {
        if (!id) {
          throw new Error("Action ID is required");
        }
        const response = await actionsUpdate({
          path: { id },
          body: formData,
        });
        const updatedAction = response.data;
        if (!updatedAction) {
          throw new Error("Failed to update action");
        }
        setAction((prev) => (prev ? { ...prev, ...form } : null));
      }
      setSaving(false);
    } catch (err) {
      setError("Failed to save action");
      setSaving(false);
      console.error(err);
    }
  };

  const handleCancel = () => {
    navigate("/");
  };

  const handleDelete = async () => {
    if (!id || isNewAction) return;

    if (
      window.confirm(
        "Are you sure you want to delete this action? This cannot be undone."
      )
    ) {
      try {
        setLoading(true);
        const response = await actionsRemove({
          path: { id },
        });
        if (response.error) {
          throw new Error("Failed to delete action");
        }
        navigate("/");
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

  return (
    <div className="flex flex-col min-h-screen bg-pagebg p-8">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-[#111] text-[20pt] font-bold font-sabon">
            {isNewAction ? "Create New Action" : `Edit Action: ${action?.name}`}
          </h1>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Back to Actions
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <Card style={CardStyle.White}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="block font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="category"
                className="block font-medium text-gray-700"
              >
                Category *
              </label>
              <input
                type="text"
                id="category"
                name="category"
                value={form.category}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="whyJoin"
                className="block font-medium text-gray-700"
              >
                Why Join
              </label>
              <textarea
                id="whyJoin"
                name="whyJoin"
                value={form.whyJoin}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="status"
                className="block font-medium text-gray-700"
              >
                Status *
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="image"
                className="block font-medium text-gray-700"
              >
                Image
              </label>
              <input
                type="file"
                id="image"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                ref={fileInputRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Only JPEG images are accepted. Maximum size: 1MB
              </p>

              {/* Show preview of newly selected image */}
              {imagePreview && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    New Image Preview:
                  </p>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-w-md h-auto rounded-md border border-gray-300"
                  />
                </div>
              )}

              {/* Show existing image if editing and no new image selected */}
              {!imagePreview && !isNewAction && form.image && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Current Image:
                  </p>
                  <img
                    src={`${baseUrl}/images/${form.image}`}
                    alt="Current"
                    className="w-full max-w-md h-auto rounded-md border border-gray-300"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              {!isNewAction && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  disabled={saving}
                >
                  Delete Action
                </button>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={saving || uploadingImage}
                >
                  {saving || uploadingImage
                    ? uploadingImage
                      ? "Uploading Image..."
                      : "Saving..."
                    : isNewAction
                      ? "Create Action"
                      : "Update Action"}
                </button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AdminActionPage;
