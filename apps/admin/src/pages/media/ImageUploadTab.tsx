import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import Button, { ButtonVariant } from "../../ui/Button";
import { FileInput } from "../../ui/FileInput";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";
import {
  Field,
  FormSection,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import { useToast } from "../../ui/ToastProvider";
import { useImageUpload } from "./useImageUpload";

const STATE_TEXT = {
  [SaveState.Saving]: "Uploading…",
  [SaveState.Saved]: "Uploaded",
  [SaveState.Failed]: "Couldn't upload",
};

export function ImageUploadTab() {
  const { success } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ file?: string }>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const upload = useImageUpload({
    onSuccess: (url) => {
      setUploadedUrl(url);
      setCopyFailed(false);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const file = files[0];
    if (!file) {
      setErrors({ file: "Choose an image to upload" });
      focusFirstInvalid();
      return;
    }
    upload.mutate(file);
  };

  const copyLink = async (url: string) => {
    const copied = await copyToClipboard(url);
    setCopyFailed(!copied);
    if (copied) success("Copied link");
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
          footer={
            <SaveBar
              state={state}
              saveLabel="Upload"
              stateText={STATE_TEXT}
              error={
                upload.isError
                  ? adminRefusalMessage(upload.error, SAVE_FAILED_FALLBACK)
                  : null
              }
            />
          }
        >
          <Field label="Image" error={errors.file}>
            {(control) => (
              <FileInput
                {...control}
                accept="image/*"
                value={files}
                onChange={(chosen) => {
                  setFiles(chosen);
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
              <>
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
                <InlineError
                  message={
                    copyFailed
                      ? "Couldn't copy the link. Select it and copy it yourself."
                      : null
                  }
                />
              </>
            )}
          </Field>
        </FormSection>
      )}
    </PageBody>
  );
}
