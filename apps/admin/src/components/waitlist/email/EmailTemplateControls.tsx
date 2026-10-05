import type { WaitlistEmailTemplateDto } from "@alliance/shared/client/types.gen";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Menu } from "@base-ui/react/menu";
import { BookmarkPlus, ChevronDown, Save, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useRefusalToast } from "../../../lib/useRefusalToast";
import {
  useDeleteWaitlistEmailTemplateAdmin,
  useSaveWaitlistEmailTemplateAdmin,
  useWaitlistEmailTemplatesAdmin,
} from "../../../lib/useWaitlistEmailTemplatesAdmin";
import { completeDraft, type EmailDraft } from "../../../lib/waitlistEmail";
import ConfirmDialog from "../../ConfirmDialog";
import InlineNameForm from "../InlineNameForm";
import {
  DELETE_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  MENU_TRIGGER_CLASS,
} from "../controlClasses";

type EmailTemplateControlsProps = {
  draft: EmailDraft;
  onLoad: (draft: EmailDraft) => void;
};

const EmailTemplateControls: React.FC<EmailTemplateControlsProps> = ({
  draft,
  onLoad,
}) => {
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const templates = useWaitlistEmailTemplatesAdmin();
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const [replacing, setReplacing] = useState<WaitlistEmailTemplateDto | null>(
    null,
  );
  const [updating, setUpdating] = useState<WaitlistEmailTemplateDto | null>(
    null,
  );
  const [deleting, setDeleting] = useState<WaitlistEmailTemplateDto | null>(
    null,
  );
  const loaded = templates.data?.find((template) => template.id === loadedId);

  const load = (template: WaitlistEmailTemplateDto) => {
    setLoadedId(template.id);
    setReplacing(null);
    onLoad({ subject: template.subject, body: template.body });
  };

  const save = useSaveWaitlistEmailTemplateAdmin({
    onSuccess: (template, id) => {
      setNaming(false);
      if (id === null) setLoadedId(template.id);
      success(
        id === null
          ? `Saved template “${template.name}”`
          : `Updated template “${template.name}”`,
      );
    },
    onError: (err) => refusalToast(err, "Could not save the template."),
    onSettled: () => setUpdating(null),
  });

  const remove = useDeleteWaitlistEmailTemplateAdmin({
    onSuccess: (template) => {
      setLoadedId(null);
      success(`Deleted template “${template.name}”`);
    },
    onError: (err) => refusalToast(err, "Could not delete the template."),
    onSettled: () => setDeleting(null),
  });

  const changedFromLoaded =
    loaded !== undefined &&
    (loaded.subject !== draft.subject.trim() || loaded.body !== draft.body);
  const written = draft.subject.trim() !== "" || draft.body.trim() !== "";
  const unsaved = written && (loaded ? changedFromLoaded : true);
  const savable = completeDraft(draft);

  if (naming) {
    return (
      <InlineNameForm
        label="Template name"
        placeholder="Template name"
        submitLabel="Save template"
        maxLength={100}
        disabled={save.isPending || !savable}
        onSubmit={(name) => save.mutate({ id: null, body: { name, ...draft } })}
        onCancel={() => setNaming(false)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Menu.Root>
        <Menu.Trigger
          disabled={!templates.data?.length}
          className={MENU_TRIGGER_CLASS}
        >
          {loaded ? `Template: ${loaded.name}` : "Use template"}
          <ChevronDown size={14} />
        </Menu.Trigger>
        <DropdownMenuContent className="min-w-44 max-h-80 overflow-y-auto">
          {templates.data?.map((template) => (
            <DropdownMenuItem
              key={template.id}
              onClick={() =>
                unsaved ? setReplacing(template) : load(template)
              }
            >
              {template.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </Menu.Root>
      {loaded && changedFromLoaded && (
        <button
          type="button"
          aria-label={`Update template ${loaded.name}`}
          title={`Update template ${loaded.name}`}
          className={ICON_BUTTON_CLASS}
          disabled={save.isPending || !savable}
          onClick={() => setUpdating(loaded)}
        >
          <Save size={16} />
        </button>
      )}
      <button
        type="button"
        aria-label="Save draft as template"
        title="Save draft as template"
        className={ICON_BUTTON_CLASS}
        disabled={!savable}
        onClick={() => setNaming(true)}
      >
        <BookmarkPlus size={16} />
      </button>
      {loaded && (
        <button
          type="button"
          aria-label={`Delete template ${loaded.name}`}
          title={`Delete template ${loaded.name}`}
          className={DELETE_BUTTON_CLASS}
          onClick={() => setDeleting(loaded)}
        >
          <Trash2 size={16} />
        </button>
      )}
      {templates.error && (
        <span className="text-red-600">
          {adminRefusalMessage(templates.error, "Unable to load templates.")}
        </span>
      )}
      <ConfirmDialog
        isOpen={replacing !== null}
        title={`Use “${replacing?.name}”?`}
        message="Replaces the subject and body you have written."
        onConfirm={() => replacing && load(replacing)}
        onCancel={() => setReplacing(null)}
      />
      <ConfirmDialog
        isOpen={updating !== null}
        title={`Update template “${updating?.name}”?`}
        message="Replaces its subject and body with this draft."
        onConfirm={() =>
          updating &&
          save.mutate({
            id: updating.id,
            body: { name: updating.name, ...draft },
          })
        }
        onCancel={() => setUpdating(null)}
        isLoading={save.isPending}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        title={`Delete template “${deleting?.name}”?`}
        message="Deletes the template. Emails already sent from it keep their content."
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default EmailTemplateControls;
