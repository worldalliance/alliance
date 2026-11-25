import type { WaitlistEmailTemplateDto } from "@alliance/shared/client/types.gen";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useDeleteWaitlistEmailTemplateAdmin,
  useSaveWaitlistEmailTemplateAdmin,
  useWaitlistEmailTemplatesAdmin,
} from "../../lib/useWaitlistEmailTemplatesAdmin";
import { completeDraft, type EmailDraft } from "../../lib/waitlistEmail";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import InlineError from "../../ui/InlineError";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { menuTriggerClass } from "./MultiSelectMenu";
import { NameDialog } from "./NameDialog";

/**
 * Start from a saved template, save the draft as one, or update or delete the
 * one loaded. Loading over unsaved writing asks first.
 */
export function EmailTemplateControls({
  draft,
  onLoad,
}: {
  draft: EmailDraft;
  onLoad: (draft: EmailDraft) => void;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const templates = useWaitlistEmailTemplatesAdmin();
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const [nameRefusal, setNameRefusal] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const loaded = templates.data?.find((template) => template.id === loadedId);

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
    onError: (err) => {
      const message = adminRefusalMessage(err, "Couldn't save the template.");
      if (naming) setNameRefusal(message);
      else setRefusal(message);
    },
    onSettled: () => {},
  });
  const remove = useDeleteWaitlistEmailTemplateAdmin({
    onSuccess: (template) => {
      setLoadedId(null);
      success(`Deleted template “${template.name}”`);
    },
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't delete the template.")),
    onSettled: () => {},
  });

  const changedFromLoaded =
    loaded !== undefined &&
    (loaded.subject !== draft.subject.trim() || loaded.body !== draft.body);
  const written = draft.subject.trim() !== "" || draft.body.trim() !== "";
  const unsaved = written && (loaded ? changedFromLoaded : true);
  const savable = completeDraft(draft);

  const load = async (template: WaitlistEmailTemplateDto) => {
    if (unsaved) {
      const ok = await confirm({
        title: `Use the template “${template.name}”?`,
        message: "Replaces the subject and body you have written.",
        confirmLabel: "Replace draft",
      });
      if (!ok) return;
    }
    setRefusal(null);
    setLoadedId(template.id);
    onLoad({ subject: template.subject, body: template.body });
  };
  const confirmUpdate = async (template: WaitlistEmailTemplateDto) => {
    const ok = await confirm({
      title: `Update the template “${template.name}”?`,
      message: "Replaces its subject and body with this draft.",
      confirmLabel: "Update template",
    });
    if (!ok) return;
    setRefusal(null);
    save.mutate({ id: template.id, body: { name: template.name, ...draft } });
  };
  const confirmDelete = async (template: WaitlistEmailTemplateDto) => {
    const ok = await confirm({
      title: `Delete the template “${template.name}”?`,
      message:
        "Deletes the template. Emails already sent from it keep their content.",
      confirmLabel: "Delete template",
      destructive: true,
    });
    if (!ok) return;
    setRefusal(null);
    remove.mutate(template);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={menuTriggerClass}
            disabled={!templates.data?.length}
          >
            {loaded ? `Template: ${loaded.name}` : "Use template"}
            <ChevronDown aria-hidden="true" className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 min-w-48">
            {templates.data?.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => void load(template)}
              >
                {template.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="small"
          variant={ButtonVariant.Ghost}
          disabled={!savable}
          onClick={() => {
            setNameRefusal(null);
            setNaming(true);
          }}
        >
          Save as template…
        </Button>
        {loaded && (
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            aria-label={`Delete template: ${loaded.name}`}
            busy={remove.isPending}
            onClick={() => void confirmDelete(loaded)}
          >
            Delete template
          </Button>
        )}
        {loaded && changedFromLoaded && (
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            aria-label={`Update template: ${loaded.name}`}
            busy={save.isPending && !naming}
            disabled={!savable}
            onClick={() => void confirmUpdate(loaded)}
          >
            Update template
          </Button>
        )}
      </div>
      <InlineError
        message={
          refusal ??
          (templates.isLoadingError
            ? `Couldn't load templates. ${adminRefusalMessage(templates.error, LOAD_FAILED_FALLBACK)}`
            : null)
        }
      />
      {naming && (
        <NameDialog
          title="Save as template"
          label="Template name"
          description="Saves this subject and body to start other emails from."
          submitLabel="Save template"
          busy={save.isPending}
          error={nameRefusal}
          blocked={
            savable
              ? null
              : "Write a subject and body, with known placeholders only."
          }
          onSubmit={(name) =>
            save.mutate({ id: null, body: { name, ...draft } })
          }
          onClose={() => setNaming(false)}
        />
      )}
    </div>
  );
}
