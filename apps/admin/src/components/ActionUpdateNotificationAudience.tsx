import type {
  ActionUpdateNotifyType,
  AdminActionUpdateDto,
} from "@alliance/shared/client";
import {
  type ActionUpdateForm,
  usesRecognition,
} from "../lib/actionUpdateDetails";
import {
  ACTION_UPDATE_NOTIFY_TYPE_LABELS,
  ACTION_UPDATE_NOTIFY_TYPES,
} from "../lib/actionUpdateNotifyTypes";
import { useTagsAdmin } from "../lib/useTagsAdmin";
import { NotificationHeldBanner } from "./ActionUpdateRecognition";

export function NotificationAudienceFields({
  form,
  onChange,
  update,
  notifying,
  notifyBlockedReason,
  onNotify,
}: {
  form: ActionUpdateForm;
  onChange: (form: ActionUpdateForm) => void;
  update: AdminActionUpdateDto;
  notifying: boolean;
  notifyBlockedReason: string | null;
  onNotify: (audienceLabel: string) => void;
}) {
  const { tags: availableTags } = useTagsAdmin();
  const recognition = usesRecognition(form.notificationMode);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Audience</span>
          <select
            value={form.notifyType}
            onChange={(e) =>
              onChange({
                ...form,
                notifyType: e.target.value as ActionUpdateNotifyType,
              })
            }
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {ACTION_UPDATE_NOTIFY_TYPES.map((option) => (
              <option key={option} value={option}>
                {ACTION_UPDATE_NOTIFY_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        {form.notifyType === "tag" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Target tag</span>
            <select
              value={form.tagId}
              onChange={(e) => onChange({ ...form, tagId: e.target.value })}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a tag</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
        {update.notificationHeldReason && (
          <NotificationHeldBanner reason={update.notificationHeldReason} />
        )}
        {update.notifiedAt ? (
          <p className="text-sm text-gray-700">
            Sent {new Date(update.notifiedAt).toLocaleString()} to{" "}
            {ACTION_UPDATE_NOTIFY_TYPE_LABELS[update.notifyType].toLowerCase()}.
            An update can only be notified about once.
            {recognition &&
              !update.recognitionPreparedAt &&
              " Each member's copy is sent when the update comes due."}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onNotify(
                  ACTION_UPDATE_NOTIFY_TYPE_LABELS[
                    update.notifyType
                  ].toLowerCase(),
                )
              }
              disabled={notifying || notifyBlockedReason !== null}
              className="px-4 py-2 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:hover:scale-100"
            >
              {notifying ? "Sending..." : "Send notification"}
            </button>
            <p className="text-xs text-gray-500">
              {notifyBlockedReason ??
                "Nothing has been sent yet. Members are notified when you send it."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
