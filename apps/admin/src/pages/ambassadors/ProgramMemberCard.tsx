import type { AmbassadorProgramMemberDto } from "@alliance/shared/client/types.gen";
import { todayDateInputValue } from "@alliance/shared/lib/dateInput";
import { useId, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { memberHref } from "../../lib/hrefs";
import { useCreateAmbassadorProgramInteractionAdmin } from "../../lib/useAmbassadorProgramAdmin";
import { AvatarProfile } from "../../ui/Avatar";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { DateField } from "../../ui/DateField";
import InlineError from "../../ui/InlineError";
import { nameLinkClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";
import { InviteGoals } from "./InviteGoals";
import {
  interactionDay,
  memberDisplayName,
  ProgramSection,
  SECTION,
} from "./programRules";

function InteractionForm({ userId }: { userId: number }) {
  const [text, setText] = useState("");
  const [day, setDay] = useState(todayDateInputValue);
  const [textError, setTextError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const create = useCreateAmbassadorProgramInteractionAdmin();

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = text.trim();
        setTextError(trimmed ? null : "Write what happened");
        setDayError(day ? null : "Choose the day it happened");
        if (!trimmed || !day) return;
        setRefusal(null);
        create.mutate(
          { userId, text: trimmed, interactionDate: day },
          {
            onSuccess: () => {
              setText("");
              setDay(todayDateInputValue());
            },
            onError: (error) =>
              setRefusal(
                adminRefusalMessage(error, "Couldn't add the interaction."),
              ),
          },
        );
      }}
    >
      <Field label="Interaction note" error={textError}>
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            className="min-h-16"
            value={text}
            readOnly={create.isPending}
            onChange={(event) => {
              setText(event.target.value);
              setTextError(null);
            }}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-start gap-3">
        <Field label="Date" error={dayError} className="w-44">
          {(control) => (
            <DateField
              {...control}
              value={day}
              readOnly={create.isPending}
              onChange={(value) => {
                setDay(value);
                setDayError(null);
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="invisible">
            &nbsp;
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant={ButtonVariant.Default}
              type="submit"
              busy={create.isPending}
            >
              Add entry
            </Button>
            <InlineError message={refusal} />
          </div>
        </div>
      </div>
    </form>
  );
}

export function ProgramMemberCard({
  member,
  section,
  removing,
  onRemove,
}: {
  member: AmbassadorProgramMemberDto;
  section: ProgramSection;
  removing: boolean;
  onRemove: () => void;
}) {
  const titleId = useId();
  const name = memberDisplayName(member.user);
  const tags = [...(member.user.tags ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return (
    <article
      aria-labelledby={titleId}
      data-member={member.userId}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card"
    >
      <header className="flex items-start gap-3">
        <AvatarProfile pfp={member.user.profilePicture} size="large" alt="" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={titleId} className="truncate">
            <Link to={memberHref(member.userId)} className={nameLinkClass}>
              {name}
            </Link>
          </h3>
          {member.user.email && (
            <span className="truncate text-fg-muted">{member.user.email}</span>
          )}
          {(member.user.ambassador || tags.length > 0) && (
            <span className="flex flex-wrap gap-1">
              {member.user.ambassador && <Badge>Ambassador</Badge>}
              {tags.map((tag) => (
                <Badge key={tag.id}>{tag.name}</Badge>
              ))}
            </span>
          )}
        </div>
      </header>
      <InteractionForm userId={member.userId} />
      {section === ProgramSection.Active && <InviteGoals member={member} />}
      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h4 className="font-semibold">Interactions</h4>
        {member.interactions.length === 0 ? (
          <p className="text-fg-muted">No interactions yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {member.interactions.map((interaction) => (
              <li key={interaction.id} className="flex flex-col gap-0.5 py-2.5">
                <span className="text-caption font-medium text-fg-muted">
                  {formatDate(interactionDay(interaction.interactionDate))}
                </span>
                <p className="break-words whitespace-pre-wrap">
                  {interaction.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Last, so that after a removal useFocusAfterRemoval, which focuses a
          neighbour's first button, can't land on this unconfirmed Remove. */}
      <footer className="flex justify-end border-t border-line pt-4">
        <Button
          size="small"
          variant={ButtonVariant.Default}
          aria-label={`${SECTION[section].removeLabel}: ${name}`}
          busy={removing}
          onClick={onRemove}
        >
          {SECTION[section].removeLabel}
        </Button>
      </footer>
    </article>
  );
}
