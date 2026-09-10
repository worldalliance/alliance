import {
  INVITE_LINK_TOKEN,
  INVITE_MESSAGE_TEMPLATE_MAX_LENGTH,
} from "@alliance/common/inviteMessage";
import { shareUrlsUpdateInviteMessageTemplate } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useInviteMessageTemplate } from "@alliance/shared/lib/useInviteMessageTemplate";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import FormTextarea from "../components/FormTextarea";

const InviteMessageTemplatePage = () => {
  const queryClient = useQueryClient();
  const {
    data: savedTemplate,
    isLoading,
    isError,
  } = useInviteMessageTemplate();
  const { success, error: errorToast } = useToast();
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (savedTemplate !== undefined) {
      setTemplate(savedTemplate);
    }
  }, [savedTemplate]);

  const validationError = !template.includes(INVITE_LINK_TOKEN)
    ? `Include ${INVITE_LINK_TOKEN} where the invite link should appear.`
    : template.length > INVITE_MESSAGE_TEMPLATE_MAX_LENGTH
      ? "Keep the message under 5,000 characters."
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validationError) {
      return;
    }

    setSaving(true);
    try {
      const response = await shareUrlsUpdateInviteMessageTemplate({
        body: { template },
      });
      if (response.error || !response.data) {
        throw response.error ?? new Error("Failed to save invitation message");
      }
      queryClient.setQueryData(
        queryKeys.inviteMessageTemplate(),
        response.data.template,
      );
      success("Invitation message saved.");
    } catch {
      errorToast("Could not save the invitation message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900">
          Invitation message
        </h1>
        <p className="mt-2 text-zinc-500">
          Members can copy this message from any unused invite. The app replaces
          {` ${INVITE_LINK_TOKEN} `}
          with that invite&apos;s link.
        </p>
      </div>

      <Card>
        {isLoading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : isError ? (
          <p className="text-red-500">Could not load the invitation message.</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 font-medium text-zinc-900">
              Message template
              <FormTextarea
                minRows={10}
                maxLength={INVITE_MESSAGE_TEMPLATE_MAX_LENGTH}
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                className="w-full resize-y rounded border border-zinc-300 bg-white p-3 font-normal focus:border-zinc-500 focus:outline-none"
              />
            </label>
            <div className="flex items-center justify-between gap-4">
              <p
                className={
                  validationError
                    ? "text-sm text-red-500"
                    : "text-sm text-zinc-500"
                }
              >
                {validationError ??
                  `${template.length}/${INVITE_MESSAGE_TEMPLATE_MAX_LENGTH.toLocaleString()} characters`}
              </p>
              <Button
                type="submit"
                color={ButtonColor.Black}
                disabled={
                  saving ||
                  validationError !== null ||
                  template === savedTemplate
                }
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default InviteMessageTemplatePage;
