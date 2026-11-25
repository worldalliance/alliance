import { withCount } from "@alliance/common/plural";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { useRef, useState } from "react";
import { uploadSessionExpiredMessage } from "../../lib/sessionExpired";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useReplaceVideoAdmin } from "../../lib/useVideosAdmin";
import { Input } from "../../ui/Input";
import {
  Field,
  FormSection,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { replacementFilesError } from "./mediaRules";

const FFMPEG_COMMAND =
  "ffmpeg -i input.mp4 -c:v libx264 -preset fast -crf 28 -maxrate 2M -bufsize 4M -vf scale=-2:720 -c:a aac -b:a 128k -hls_time 6 -hls_list_size 0 -hls_segment_filename segment_%03d.ts output.m3u8";

export function ReplaceVideoSection({
  videoId,
  filename,
}: {
  videoId: number;
  filename: string;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ files?: string }>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);

  const replacement = useReplaceVideoAdmin({
    videoId,
    onSuccess: () => {
      success("Video content replaced");
      setOutcome({ saved: true });
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (error) => {
      console.error("Failed to replace video", error);
      setOutcome({
        saved: false,
        reason: thrownRefusalMessage({
          error,
          fallback: "Failed to replace video content",
          sessionExpired: uploadSessionExpiredMessage,
        }),
      });
    },
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = replacementFilesError(files);
    if (problem) {
      setErrors({ files: problem });
      focusFirstInvalid();
      return;
    }
    const confirmed = await confirm({
      title: `Replace the content of “${filename}”?`,
      message: `Everyone who plays video ${videoId} gets the ${withCount(files.length, "file")} you chose. Its current files are deleted and can't be restored.`,
      confirmLabel: "Replace content",
      destructive: true,
    });
    if (!confirmed) return;
    setOutcome(null);
    replacement.mutate(files);
  };

  const state = replacement.isPending
    ? SaveState.Saving
    : outcome?.saved === false
      ? SaveState.Failed
      : outcome?.saved
        ? SaveState.Saved
        : SaveState.Clean;

  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
      <FormSection
        title="Replace video content"
        description="Swap this video's playlist and segments for files you processed yourself."
        footer={
          <SaveBar
            state={state}
            saveLabel="Replace video content"
            error={outcome?.saved === false ? outcome.reason : null}
          />
        }
      >
        <div className="flex flex-col gap-1.5">
          <p>Process the video with a command like:</p>
          <code className="block rounded-md bg-surface-2 p-3 font-mono text-xs">
            {FFMPEG_COMMAND}
          </code>
        </div>
        <Field
          label="HLS files"
          help={
            files.length > 0
              ? `${withCount(files.length, "file")} selected`
              : "The .m3u8 playlist and its .ts segments."
          }
          error={errors.files}
        >
          {(control) => (
            <Input
              {...control}
              ref={inputRef}
              type="file"
              multiple
              accept=".m3u8,.ts"
              className="py-1"
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []));
                setErrors({});
                setOutcome(null);
              }}
            />
          )}
        </Field>
      </FormSection>
    </form>
  );
}
