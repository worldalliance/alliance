import React, { useRef } from "react";
import { CreateActionDto } from "@alliance/shared/client";

interface ActionFormProps {
  form: CreateActionDto;
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  uploadingImage: boolean;
  imagePreview: string | null;
  isNew: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  baseUrl?: string;
}

const ActionForm: React.FC<ActionFormProps> = ({
  form,
  onInputChange,
  onImageChange,
  onSubmit,
  saving,
  uploadingImage,
  imagePreview,
  isNew,
  onCancel,
  onDelete,
  baseUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          {isNew ? "Create New Action" : "Action Details"}
        </h2>
        {!isNew && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            disabled={saving}
          >
            Delete Action
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="name"
            className="block font-medium text-gray-700 mb-1"
          >
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={form.name}
            onChange={onInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="category"
            className="block font-medium text-gray-700 mb-1"
          >
            Category *
          </label>
          <input
            type="text"
            id="category"
            name="category"
            value={form.category}
            onChange={onInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="type"
            className="block font-medium text-gray-700 mb-1"
          >
            Type
          </label>
          <select
            id="type"
            name="type"
            value={form.type}
            onChange={onInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Activity">Activity</option>
            <option value="Funding">Funding</option>
            <option value="Ongoing">Ongoing</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="timeEstimate"
            className="block font-medium text-gray-700 mb-1"
          >
            Time Estimate
          </label>
          <input
            type="text"
            id="timeEstimate"
            name="timeEstimate"
            value={form.timeEstimate}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Threshold Settings */}
      {form.type === "Funding" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="donationThreshold"
              className="block font-medium text-gray-700 mb-1"
            >
              Donation Threshold (cents)
            </label>
            <input
              type="number"
              id="donationThreshold"
              name="donationThreshold"
              value={form.donationThreshold || ""}
              onChange={onInputChange}
              min="0"
              step="0.01"
              placeholder="Total donations needed"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="donationAmount"
              className="block font-medium text-gray-700 mb-1"
            >
              Suggested Donation (cents)
            </label>
            <input
              type="number"
              id="donationAmount"
              name="donationAmount"
              value={form.donationAmount || ""}
              onChange={onInputChange}
              min="0"
              step="0.01"
              placeholder="Suggested amount per person"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor="commitmentThreshold"
            className="block font-medium text-gray-700 mb-1"
          >
            Commitment Threshold
          </label>
          <input
            type="number"
            id="commitmentThreshold"
            name="commitmentThreshold"
            value={form.commitmentThreshold || ""}
            onChange={onInputChange}
            min="1"
            placeholder="Number of commitments needed"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="description"
          className="block font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={form.description}
          onChange={onInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="shortDescription"
          className="block font-medium text-gray-700 mb-1"
        >
          Short Description
        </label>
        <textarea
          id="shortDescription"
          name="shortDescription"
          value={form.shortDescription}
          onChange={onInputChange}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="whyJoin"
          className="block font-medium text-gray-700 mb-1"
        >
          Why Join
        </label>
        <textarea
          id="whyJoin"
          name="whyJoin"
          value={form.whyJoin}
          onChange={onInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="howTo" className="block font-medium text-gray-700 mb-1">
          How To
        </label>
        <textarea
          id="howTo"
          name="howTo"
          value={form.howTo}
          onChange={onInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="image" className="block font-medium text-gray-700 mb-1">
          Image
        </label>
        <input
          type="file"
          id="image"
          name="image"
          accept="image/*"
          onChange={onImageChange}
          ref={fileInputRef}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {imagePreview && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-700 mb-1">
              {isNew ? "Image Preview:" : "New Image Preview:"}
            </p>
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-w-md h-auto rounded-md border border-gray-300"
            />
          </div>
        )}

        {!imagePreview && !isNew && form.image && baseUrl && (
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

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={saving || uploadingImage}
        >
          {saving || uploadingImage
            ? uploadingImage
              ? "Uploading Image..."
              : isNew
              ? "Creating..."
              : "Updating..."
            : isNew
            ? "Create Action"
            : "Update Action"}
        </button>
      </div>
    </form>
  );
};

export default ActionForm;
