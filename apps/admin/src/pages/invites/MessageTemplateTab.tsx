import {
  INVITE_LINK_TOKEN,
  INVITE_MESSAGE_TEMPLATE_MAX_LENGTH,
} from "@alliance/common/inviteMessage";
import {
  useInviteMessageTemplate,
  useUpdateInviteMessageTemplate,
} from "@alliance/shared/lib/useInviteMessageTemplate";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import {
  Field,
  FormSection,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  FormSkeleton,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { Textarea } from "../../ui/Textarea";
import { useToast } from "../../ui/ToastProvider";

export const messageTemplateProblem = (template: string): string | null =>
  !template.includes(INVITE_LINK_TOKEN)
    ? `Include ${INVITE_LINK_TOKEN} where the invite link should appear`
    : template.length > INVITE_MESSAGE_TEMPLATE_MAX_LENGTH
      ? `Keep the message under ${formatCount(INVITE_MESSAGE_TEMPLATE_MAX_LENGTH)} characters`
      : null;

export function MessageTemplateTab() {
  const saved = useInviteMessageTemplate();
  return (
    <PageBody width="form">
      <RefreshFailedBanner things="the invitation message" query={saved} />
      <ContentState
        things="the invitation message"
        query={saved}
        refreshBanner={false}
        skeleton={<FormSkeleton fields={1} />}
      >
        {saved.data !== undefined && <TemplateForm saved={saved.data} />}
      </ContentState>
    </PageBody>
  );
}

function TemplateForm({ saved }: { saved: string }) {
  const { success } = useToast();
  // A refetch reseeds the form only while it is untouched.
  const [seeded, setSeeded] = useState(saved);
  const [template, setTemplate] = useState(saved);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const dirty = template !== seeded;
  useLeaveGuard(dirty);
  if (saved !== seeded && !dirty) {
    setSeeded(saved);
    setTemplate(saved);
  }

  const save = useUpdateInviteMessageTemplate({
    onSuccess: () => {},
    onError: () => {},
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = messageTemplateProblem(template);
    setProblem(invalid);
    if (invalid) {
      focusFirstInvalid();
      return;
    }
    setOutcome(null);
    save.mutate(template, {
      onSuccess: () => {
        setSeeded(template);
        setOutcome({ saved: true });
        success("Invitation message saved");
      },
      onError: (error) =>
        setOutcome({
          saved: false,
          reason: adminRefusalMessage(error, SAVE_FAILED_FALLBACK),
        }),
    });
  };

  const state = save.isPending
    ? SaveState.Saving
    : outcome?.saved === false
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : outcome?.saved
          ? SaveState.Saved
          : SaveState.Clean;

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      <FormSection
        title="Invitation message"
        description={`Members can copy this message from an unused invite or a group invite link in the web app. The app puts that invite's link where ${INVITE_LINK_TOKEN} is.`}
        footer={
          <SaveBar
            state={state}
            error={outcome?.saved === false ? outcome.reason : null}
            note="Every member copies the new message from their next load."
            onDiscard={() => {
              setTemplate(seeded);
              setProblem(null);
              setOutcome(null);
            }}
          />
        }
      >
        <Field
          label="Message"
          help={`${formatCount(template.length)} of ${formatCount(INVITE_MESSAGE_TEMPLATE_MAX_LENGTH)} characters`}
          error={problem}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={10}
              maxLength={INVITE_MESSAGE_TEMPLATE_MAX_LENGTH}
              value={template}
              onChange={(event) => {
                setTemplate(event.target.value);
                setOutcome(null);
                if (problem)
                  setProblem(messageTemplateProblem(event.target.value));
              }}
              onBlur={() => setProblem(messageTemplateProblem(template))}
              className="resize-y"
            />
          )}
        </Field>
      </FormSection>
    </form>
  );
}
