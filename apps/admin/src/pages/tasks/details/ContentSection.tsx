import FormTextarea from "../../../components/FormTextarea";
import { ACTION_TEXT_FIELD_LABELS } from "../../../lib/actionFieldDefs";
import { FileInput } from "../../../ui/FileInput";
import { Input } from "../../../ui/Input";
import { controlClass } from "../../../ui/styles";
import { Field, FormSection } from "../../../ui/templates/Form";
import { Textarea } from "../../../ui/Textarea";
import UploadingWithCancel from "../../../ui/UploadingWithCancel";
import UserSelect from "../../../ui/UserSelect";
import type { DetailsSectionProps } from "./detailsRules";
import { ReviewersField } from "./ReviewersField";

export function ContentSection({ editor, lookups }: DetailsSectionProps) {
  const { form } = editor;
  return (
    <FormSection
      title="Content"
      description="What members read on the task's card and page."
    >
      <Field
        label={ACTION_TEXT_FIELD_LABELS.name}
        mark="required"
        error={editor.nameMissing ? "Enter a name" : null}
      >
        {(control) => (
          <Textarea
            {...control}
            name="name"
            rows={1}
            required
            value={form.name}
            onChange={editor.handleInputChange}
            className="min-h-0"
          />
        )}
      </Field>
      <Field label={ACTION_TEXT_FIELD_LABELS.shortDescription}>
        {(control) => (
          <Textarea
            {...control}
            name="shortDescription"
            rows={2}
            value={form.shortDescription ?? ""}
            onChange={editor.handleInputChange}
            className="min-h-0"
          />
        )}
      </Field>
      <Field
        label={ACTION_TEXT_FIELD_LABELS.body}
        help="Markdown. Pasting from Google Docs keeps its formatting."
      >
        {(control) => (
          <FormTextarea
            {...control}
            name="body"
            minRows={6}
            value={form.body ?? ""}
            onChange={editor.handleInputChange}
            className={controlClass}
          />
        )}
      </Field>
      <Field label="Cover image" error={editor.imageError}>
        {(control) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <FileInput
                {...control}
                name="image"
                accept="image/*"
                value={[]}
                onChange={([file]) => {
                  if (file) void editor.pickCoverImage(file);
                }}
              />
              {editor.imageUploading && (
                <UploadingWithCancel
                  label="Uploading…"
                  cancelLabel="Cancel the upload and keep the current image"
                  onCancel={editor.cancelCoverImage}
                  className="text-fg-muted"
                />
              )}
            </div>
            {editor.imagePreview && (
              <img
                src={editor.imagePreview}
                alt="Cover image"
                className="h-auto w-full max-w-sm rounded-md border border-line"
              />
            )}
          </div>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Square thumbnail URL">
          {(control) => (
            <Input
              {...control}
              name="squareThumbnailImage"
              value={form.squareThumbnailImage ?? ""}
              onChange={editor.handleInputChange}
            />
          )}
        </Field>
        <Field
          label="Thumbnail alt text"
          help="Left empty, the thumbnail is announced as the task's name."
        >
          {(control) => (
            <Input
              {...control}
              name="squareThumbnailImageAlt"
              value={form.squareThumbnailImageAlt ?? ""}
              onChange={editor.handleInputChange}
            />
          )}
        </Field>
      </div>
      <UserSelect
        label="Authors"
        users={lookups.availableUsers ?? []}
        selectedUserIds={form.authorIds ?? []}
        onChange={editor.handleAuthorsChange}
        loading={lookups.usersLoading}
        loadFailed={lookups.usersError}
      />
      <ReviewersField
        reviewers={editor.reviewerRows}
        onChange={editor.setReviewerRows}
      />
    </FormSection>
  );
}
