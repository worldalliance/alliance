import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { communiquesCreate, imagesUploadImage } from "../client/sdk.gen";
import Button, { ButtonColor } from "../components/system/Button";
import FormInput from "../components/system/FormInput";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import { getApiUrl } from "../lib/config";

const AnnouncementEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">(
    "edit"
  );

  // Image upload related states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not admin
  React.useEffect(() => {
    if (!user?.admin) {
      navigate("/announcements");
    }
  }, [user, navigate]);

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
    } catch (err) {
      console.error("Error creating announcement:", err);
      setError("Failed to create announcement. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))]">
        <div className="w-full mb-6">
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

            <div className="flex flex-col gap-1 w-full">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="bodyText"
                  className="font-avenir text-[11pt] text-stone-800 mb-1"
                >
                  Content (Markdown supported)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex border rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewMode("edit")}
                      className={`px-3 py-1 text-xs font-medium ${
                        viewMode === "edit"
                          ? "bg-cyan-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("split")}
                      className={`px-3 py-1 text-xs font-medium ${
                        viewMode === "split"
                          ? "bg-cyan-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("preview")}
                      className={`px-3 py-1 text-xs font-medium ${
                        viewMode === "preview"
                          ? "bg-cyan-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`${viewMode === "split" ? "flex gap-4" : "block"}`}
              >
                {(viewMode === "edit" || viewMode === "split") && (
                  <div className={viewMode === "split" ? "flex-1" : "w-full"}>
                    {viewMode === "split" && (
                      <div className="text-xs text-gray-500 mb-1 font-medium">
                        Editor
                      </div>
                    )}
                    <textarea
                      id="bodyText"
                      name="bodyText"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Write your announcement content here. Markdown formatting is supported."
                      required
                      rows={10}
                      className="w-full border border-gray-300 rounded-md px-3 py-3 pb-2 bg-white 
                        focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500
                        text-[11pt] font-avenir transition-all duration-200 hover:border-gray-400"
                    />

                    {viewMode === "edit" && (
                      <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                        <div className="font-medium mb-1">Markdown Syntax:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                              **Bold**
                            </code>{" "}
                            for <strong>Bold</strong>
                          </div>
                          <div>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                              *Italic*
                            </code>{" "}
                            for <em>Italic</em>
                          </div>
                          <div>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                              # Heading 1
                            </code>{" "}
                            for headings
                          </div>
                          <div>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                              - Item
                            </code>{" "}
                            for bullet lists
                          </div>
                          <div>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                              [Link](URL)
                            </code>{" "}
                            for links
                          </div>
                          <div>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">
                              ![Alt](URL)
                            </code>{" "}
                            for images
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(viewMode === "preview" || viewMode === "split") && (
                  <div className={viewMode === "split" ? "flex-1" : "w-full"}>
                    {viewMode === "split" && (
                      <div className="text-xs text-gray-500 mb-1 font-medium">
                        Preview
                      </div>
                    )}
                    <div className="border border-gray-300 rounded-md p-4 min-h-[200px] bg-white prose prose-stone max-w-none overflow-auto">
                      {bodyText ? (
                        <ReactMarkdown>{bodyText}</ReactMarkdown>
                      ) : (
                        <p className="text-gray-400 italic">
                          Preview will appear here...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

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
              <p className="text-xs text-gray-500 mt-1">
                Upload an image to display at the top of your announcement.
                Supported formats: JPEG, PNG.
              </p>

              {/* Show preview of selected image */}
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
                      : "Creating..."
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
