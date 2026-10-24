import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useState } from "react";
import {
  useReminderEmailPreviewAdmin,
  useReminderTextPreviewAdmin,
} from "../../lib/useReminderPreviewsAdmin";
import TextareaWithHighlights from "../TextareaWithHighlights";
import { keywords } from "./ReminderKeywordHelp";
import ReminderPreviewError from "./ReminderPreviewError";
import type { ReminderGroupDraft } from "./reminderGroupDraft";

type PreviewTaskCount = 1 | 2;

const toggleTaskCount =
  (count: PreviewTaskCount) => (current: PreviewTaskCount | null) =>
    current === count ? null : count;

interface ReminderMessageFieldsProps {
  eventId: number | null;
  draft: Pick<
    ReminderGroupDraft,
    "emailSubject" | "emailMessage" | "textMessage" | "pushMessage"
  >;
  onChange: (patch: Partial<ReminderGroupDraft>) => void;
}

const ReminderMessageFields: React.FC<ReminderMessageFieldsProps> = ({
  eventId,
  draft,
  onChange,
}) => {
  const [emailPreviewTaskCount, setEmailPreviewTaskCount] =
    useState<PreviewTaskCount | null>(null);
  const [textPreviewTaskCount, setTextPreviewTaskCount] =
    useState<PreviewTaskCount | null>(null);
  const [pushPreviewTaskCount, setPushPreviewTaskCount] =
    useState<PreviewTaskCount | null>(null);

  const emailPreview = useReminderEmailPreviewAdmin(
    eventId,
    emailPreviewTaskCount === null
      ? null
      : {
          emailMessage: draft.emailMessage,
          emailSubject: draft.emailSubject,
          taskCount: emailPreviewTaskCount,
        },
  );
  const textPreview = useReminderTextPreviewAdmin(
    eventId,
    textPreviewTaskCount === null
      ? null
      : { textMessage: draft.textMessage, taskCount: textPreviewTaskCount },
  );
  const pushPreview = useReminderTextPreviewAdmin(
    eventId,
    pushPreviewTaskCount === null
      ? null
      : { textMessage: draft.pushMessage, taskCount: pushPreviewTaskCount },
  );

  const handlePreviewEmail2Task = () =>
    setEmailPreviewTaskCount(toggleTaskCount(2));

  const handlePreviewEmail1Task = () =>
    setEmailPreviewTaskCount(toggleTaskCount(1));

  const handlePreviewText1Task = () =>
    setTextPreviewTaskCount(toggleTaskCount(1));

  const handlePreviewText2Task = () =>
    setTextPreviewTaskCount(toggleTaskCount(2));

  const handlePreviewPushTask = () =>
    setPushPreviewTaskCount(toggleTaskCount(1));

  const handlePreviewPush2Task = () =>
    setPushPreviewTaskCount(toggleTaskCount(2));

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Subject
        </label>
        <TextareaWithHighlights
          keywords={keywords}
          value={draft.emailSubject}
          onChange={(value) => onChange({ emailSubject: value })}
          rows={1}
          highlightHashPipeSyntax
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Message
          </label>
          <Button
            onClick={handlePreviewEmail1Task}
            size={"small"}
            color={
              emailPreviewTaskCount === 1
                ? ButtonColor.Stone
                : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Email (1 task)
          </Button>
          <Button
            onClick={handlePreviewEmail2Task}
            size={"small"}
            color={
              emailPreviewTaskCount === 2
                ? ButtonColor.Stone
                : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Email (2 tasks)
          </Button>
        </div>
        {emailPreviewTaskCount !== null ? (
          <Card className="p-4">
            <ReminderPreviewError error={emailPreview.error} />
            <p className="font-bold mb-4">{emailPreview.data?.subject}</p>
            <div
              dangerouslySetInnerHTML={{
                __html: emailPreview.data?.html ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={draft.emailMessage}
            onChange={(value) => onChange({ emailMessage: value })}
            rows={5}
            highlightHashPipeSyntax
          />
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Text Message
          </label>
          <Button
            onClick={handlePreviewText1Task}
            size={"small"}
            color={
              textPreviewTaskCount === 1 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Text (1 task)
          </Button>
          <Button
            onClick={handlePreviewText2Task}
            size={"small"}
            color={
              textPreviewTaskCount === 2 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Text (2 tasks)
          </Button>
        </div>
        {textPreviewTaskCount !== null ? (
          <Card className="p-4">
            <ReminderPreviewError error={textPreview.error} />
            <p
              dangerouslySetInnerHTML={{
                __html: textPreview.data?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={draft.textMessage}
            onChange={(value) => onChange({ textMessage: value })}
            rows={2}
            highlightHashPipeSyntax
          />
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Push Message
          </label>
          <Button
            onClick={handlePreviewPushTask}
            size={"small"}
            color={
              pushPreviewTaskCount === 1 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Push (1 task)
          </Button>
          <Button
            onClick={handlePreviewPush2Task}
            size={"small"}
            color={
              pushPreviewTaskCount === 2 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Push (2 tasks)
          </Button>
        </div>
        {pushPreviewTaskCount !== null ? (
          <Card className="p-4">
            <ReminderPreviewError error={pushPreview.error} />
            <p
              dangerouslySetInnerHTML={{
                __html: pushPreview.data?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={draft.pushMessage}
            onChange={(value) => onChange({ pushMessage: value })}
            rows={2}
            highlightHashPipeSyntax
          />
        )}
      </div>
    </>
  );
};

export default ReminderMessageFields;
