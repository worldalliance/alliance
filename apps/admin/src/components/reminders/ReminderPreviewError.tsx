import { errorMessage } from "@alliance/common/errorMessage";

const ReminderPreviewError = ({ error }: { error: Error | null }) =>
  error && (
    <p className="text-red-600 text-sm" role="alert">
      {errorMessage({ error, fallback: "Unable to load preview" })}
    </p>
  );

export default ReminderPreviewError;
