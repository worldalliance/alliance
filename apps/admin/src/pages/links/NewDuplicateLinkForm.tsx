import { SHARE_URL_LABEL_MAX_LENGTH } from "@alliance/common/shareUrlLabel";
import type { ExternalShareTargetDto } from "@alliance/shared/client/types.gen";
import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { Combobox } from "../../ui/Combobox";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { ListCreateForm } from "./ListCreateForm";
import { TARGET_KIND_LABEL, type Target, TargetKind } from "./shareLinkTargets";

type Named = { id: number; name: string };
type Task = Named & { archived: boolean };

const PICK_LABEL: Record<TargetKind, string> = {
  [TargetKind.Task]: "Task",
  [TargetKind.External]: "Share target",
  [TargetKind.Invite]: "Target",
};
const PLACEHOLDER: Record<TargetKind, string> = {
  [TargetKind.Task]: "Pick a task",
  [TargetKind.External]: "Pick a share target",
  [TargetKind.Invite]: "",
};

const parseKind = (value: string): TargetKind =>
  Object.values(TargetKind).find((kind) => kind === value) ?? TargetKind.Task;

export function NewDuplicateLinkForm({
  ownerName,
  tasks,
  shareTargets,
  busy,
  refusal,
  onCreate,
}: {
  ownerName: string;
  tasks: UseQueryResult<Task[]>;
  shareTargets: UseQueryResult<ExternalShareTargetDto[]>;
  busy: boolean;
  refusal: string | null;
  /** Resolves true once created, so the label clears. */
  onCreate: (input: { target: Target; label: string }) => Promise<boolean>;
}) {
  const [kind, setKind] = useState(TargetKind.Task);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const choices: Record<TargetKind, Named[]> = {
    [TargetKind.Task]: (tasks.data ?? []).filter((task) => !task.archived),
    [TargetKind.External]: shareTargets.data ?? [],
    [TargetKind.Invite]: [],
  };
  const loading: Record<TargetKind, boolean> = {
    [TargetKind.Task]: tasks.isPending,
    [TargetKind.External]: shareTargets.isPending,
    [TargetKind.Invite]: false,
  };
  const loadError: Record<TargetKind, string | null> = {
    [TargetKind.Task]: tasks.isLoadingError
      ? adminRefusalMessage(tasks.error, "Couldn't load tasks.")
      : null,
    [TargetKind.External]: shareTargets.isLoadingError
      ? adminRefusalMessage(shareTargets.error, "Couldn't load share targets.")
      : null,
    [TargetKind.Invite]: null,
  };

  const chosen = (): Target | null => {
    if (kind === TargetKind.Invite) return { kind };
    const found = choices[kind].find((choice) => choice.id === targetId);
    return found ? { kind, id: found.id, name: found.name } : null;
  };

  const submit = async () => {
    const target = chosen();
    if (!target) {
      setTargetError(
        kind === TargetKind.Task ? "Choose a task" : "Choose a share target",
      );
      focusFirstInvalid();
      return;
    }
    if (await onCreate({ target, label })) setLabel("");
  };

  return (
    <ListCreateForm
      label="New duplicate link"
      formRef={formRef}
      onSubmit={() => void submit()}
      submitLabel="Create duplicate"
      busy={busy}
      error={refusal}
      note={
        kind === TargetKind.Invite
          ? `A trackable signup link that credits new signups to ${ownerName}.`
          : `Another trackable link to the same target, to hand to one recruit. It can be for a target ${ownerName} hasn't shared yet.`
      }
    >
      <Field label="Link to" className="w-40">
        {(control) => (
          <Select
            {...control}
            value={kind}
            disabled={busy}
            onChange={(event) => {
              setKind(parseKind(event.target.value));
              setTargetId(null);
              setTargetError(null);
            }}
          >
            {Object.values(TargetKind).map((value) => (
              <option key={value} value={value}>
                {TARGET_KIND_LABEL[value]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label={PICK_LABEL[kind]}
        className="w-80"
        help={
          kind === TargetKind.Invite
            ? "A signup link has no target to choose."
            : undefined
        }
        error={loadError[kind] ?? targetError}
      >
        {(control) => (
          <Combobox
            key={kind}
            {...control}
            options={choices[kind].map((choice) => ({
              value: choice.id,
              label: choice.name,
            }))}
            value={targetId}
            onChange={(id) => {
              setTargetId(id);
              setTargetError(null);
            }}
            placeholder={PLACEHOLDER[kind]}
            loading={loading[kind]}
            loadError={loadError[kind]}
            disabled={busy || kind === TargetKind.Invite}
          />
        )}
      </Field>
      <Field label="Label" mark="optional" className="min-w-56 flex-1">
        {(control) => (
          <Input
            {...control}
            value={label}
            maxLength={SHARE_URL_LABEL_MAX_LENGTH}
            readOnly={busy}
            placeholder="Recruit's name"
            onChange={(event) => setLabel(event.target.value)}
          />
        )}
      </Field>
    </ListCreateForm>
  );
}
