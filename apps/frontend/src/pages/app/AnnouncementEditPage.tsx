import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  communiquesCreate,
  communiquesFindOne,
  communiquesUpdate,
  imagesUploadImage,
} from "../../../../../shared/client";
import Button, { ButtonColor } from "../../components/system/Button";
import FormInput from "../../components/system/FormInput";
import { useAuth } from "../../../../../shared/lib/BaseAuthContext";
import MarkdownEditor from "../../components/MarkdownEditor";

const AnnouncementEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id); // Only set loading true if editing existing item
  const isEditing = !!id;

  // Image upload related states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!user?.admin) {
      navigate("/announcements");
    }
  }, [user, navigate]);

  // Load existing announcement data if editing
  useEffect(() => {
    if (!id || !isEditing) return;

    const fetchAnnouncement = async () => {
      try {
        setLoading(true);
        const response = await communiquesFindOne({
          path: { id },
        });

        if (response.error || !response.data) {
          throw new Error("Failed to fetch announcement");
        }

        const announcement = response.data;

        // Populate form with existing data
        setTitle(announcement.title);
        setBodyText(announcement.bodyText);
        setHeaderImage(announcement.headerImage);

        setLoading(false);
      } catch (err) {
        console.error("Error loading announcement:", err);
        setError("Could not load announcement data. Please try again.");
        setLoading(false);
      }
    };

    fetchAnnouncement();
  }, [id, isEditing]);

  // Handle image file selection
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

  // Upload image to server
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploadingImage(true);
      setError(null);

      const response = await imagesUploadImage({
        body: { image: imageFile },
      });

      if (!response.data || response.error) {
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
    setIsSubmitting(true);
    setError(null);

    try {
      // Upload image first if one is selected
      let imageFilename = headerImage;
      if (imageFile) {
        const uploadedImageFilename = await uploadImage();
        if (!uploadedImageFilename && imageFile) {
          throw new Error("Failed to upload image");
        }
        imageFilename = uploadedImageFilename;
      }

      if (isEditing && id) {
        // Update existing announcement
        const response = await communiquesUpdate({
          path: { id },
          body: {
            title,
            bodyText,
            headerImage: imageFilename,
            // Don't update the dateCreated when editing
          },
        });

        if (response.error) {
          throw new Error("Failed to update announcement");
        }

        // Redirect to the announcement page on success
        navigate(`/announcements/${id}`);
      } else {
        // Create new announcement
        const response = await communiquesCreate({
          body: {
            title,
            bodyText,
            headerImage: imageFilename,
            dateCreated: new Date().toISOString(),
          },
        });

        if (response.error) {
          throw new Error("Failed to create announcement");
        }

        // Redirect to announcements list on success
        navigate("/announcements");
      }
    } catch (err) {
      console.error("Error saving announcement:", err);
      setError(
        `Failed to ${isEditing ? "update" : "create"} announcement. Please try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-pagebg items-center">
        <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))]">
          <p className="text-center py-4">Loading announcement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-pagebg items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))]">
        <div className="w-full mb-6">
          <h1 className="text-2xl font-bold mb-4">
            {isEditing ? "Edit Announcement" : "Create New Announcement"}
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Title"
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter announcement title"
              required
            />

            <MarkdownEditor
              value={bodyText}
              onChange={setBodyText}
              placeholder="Write your announcement content here. Markdown formatting is supported."
              label="Content (Markdown supported)"
              required={true}
              initialMode="edit"
              showSyntaxHelp={true}
            />

            <div className="flex flex-col gap-1 w-full">
              <label
                htmlFor="headerImage"
                className="font-avenir text-[11pt] text-stone-800 mb-1"
              >
                Header Image (optional)
              </label>
              <input
                type="file"
                id="headerImage"
                name="headerImage"
                accept="image/*"
                onChange={handleImageChange}
                ref={fileInputRef}
                className="border border-gray-300 rounded-md px-3 py-2 w-full text-[11pt] font-avenir"
              />

              {imagePreview && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 font-medium mb-1">
                    Image Preview:
                  </p>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-w-md h-auto rounded-md border border-gray-300"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <Button
                label="Cancel"
                onClick={() => navigate("/announcements")}
                color={ButtonColor.Grey}
              />
              <Button
                label={
                  isSubmitting
                    ? uploadingImage
                      ? "Uploading Image..."
                      : isEditing
                        ? "Updating..."
                        : "Creating..."
                    : isEditing
                      ? "Update Announcement"
                      : "Create Announcement"
                }
                onClick={() => {}}
                type="submit"
                color={ButtonColor.Blue}
                disabled={isSubmitting || uploadingImage}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementEditPage;
