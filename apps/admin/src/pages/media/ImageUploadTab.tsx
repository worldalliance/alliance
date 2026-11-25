import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  Field,
  FormSection,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import { useToast } from "../../ui/ToastProvider";
import { useImageUpload } from "./useImageUpload";

export function ImageUploadTab() {
  const { success, error: toastError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ file?: string }>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const upload = useImageUpload({
    onSuccess: (url) => {
      setUploadedUrl(url);
      success("Image uploaded");
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setErrors({ file: "Choose an image to upload" });
      focusFirstInvalid();
      return;
    }
    upload.mutate(file);
  };

  const copyLink = async (url: string) => {
    if (await copyToClipboard(url)) success("Copied link");
    else toastError("Couldn't copy the link. Select it and copy it yourself.");
  };

  const state = upload.isPending
    ? SaveState.Saving
    : upload.isError
      ? SaveState.Failed
      : upload.isSuccess
        ? SaveState.Saved
        : SaveState.Clean;

  return (
    <PageBody width="form">
      <form ref={formRef} onSubmit={submit} noValidate>
        <FormSection
          title="Upload an image"
          description="Upload an image to get a link you can paste anywhere."
          footer={
            <SaveBar
              state={state}
              saveLabel="Upload"
              error={
                upload.isError
                  ? adminRefusalMessage(upload.error, "Failed to upload image.")
                  : null
              }
            />
          }
        >
          <Field label="Image" error={errors.file}>
            {(control) => (
              <Input
                {...control}
                type="file"
                accept="image/*"
                className="py-1"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setErrors({});
                  upload.reset();
                }}
              />
            )}
          </Field>
        </FormSection>
      </form>

      {uploadedUrl && (
        <FormSection title="Uploaded image">
          <img
            src={uploadedUrl}
            alt="The uploaded image"
            className="max-h-80 max-w-full self-start rounded-md border border-line"
          />
          <Field label="Link">
            {(control) => (
              <div className="flex gap-2">
                <Input
                  {...control}
                  readOnly
                  value={uploadedUrl}
                  className="font-mono text-xs"
                  onFocus={(event) => event.target.select()}
                />
                <Button
                  variant={ButtonVariant.Default}
                  className="shrink-0"
                  onClick={() => void copyLink(uploadedUrl)}
                >
                  Copy link
                </Button>
              </div>
            )}
          </Field>
        </FormSection>
      )}
    </PageBody>
  );
}
