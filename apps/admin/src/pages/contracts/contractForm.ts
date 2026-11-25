import type {
  ContractAdminDto,
  CreateContractDto,
  UpdateContractDto,
} from "@alliance/shared/client";
import type { Dispatch, SetStateAction } from "react";
import { contractName, inForceOf } from "./contractRules";

export type PointRow = {
  key: string;
  point: string;
  subtext: string;
  adminNotes: string;
};

/** The dates are UTC instants as ISO strings, or "" for none. */
export type ContractForm = {
  name: string;
  markdown: string;
  points: PointRow[];
  startDate: string;
  endDate: string;
};

export type ContractFieldsProps = {
  form: ContractForm;
  setForm: Dispatch<SetStateAction<ContractForm>>;
};

export type ContractErrors = {
  markdown?: string;
  /** By the point's row key. */
  points?: Record<string, string>;
  /** On the Points group as a whole. */
  noPoints?: string;
  /** On the Schedule group: the dates hand members a contract they can't sign. */
  schedule?: string;
  endDate?: string;
};

export const EMPTY_FORM: ContractForm = {
  name: "",
  markdown: "",
  points: [],
  startDate: "",
  endDate: "",
};

export const newPoint = (): PointRow => ({
  key: crypto.randomUUID(),
  point: "",
  subtext: "",
  adminNotes: "",
});

const instantOf = (date: string | null | undefined) =>
  date ? new Date(date).toISOString() : "";

export const formOf = (contract: ContractAdminDto): ContractForm => ({
  name: contract.name ?? "",
  markdown: contract.markdown,
  points: contract.description.map((item, index) => ({
    // Stable across refetches, so an untouched form compares equal to a reload.
    key: `${contract.id}-${index}`,
    ...item,
  })),
  startDate: instantOf(contract.startDate),
  endDate: instantOf(contract.endDate),
});

/** The same form with fresh keys compares equal: keys only tell rows apart. */
export const comparableOf = (form: ContractForm) => ({
  ...form,
  points: form.points.map(({ point, subtext, adminNotes }) => ({
    point,
    subtext,
    adminNotes,
  })),
});

type Listed = Pick<
  ContractAdminDto,
  "id" | "name" | "startDate" | "endDate" | "description"
>;

/** The contract in force once the form is saved; a new one goes in as id -1. */
function afterSaveOf({
  form,
  contractId,
  contracts,
  now,
}: {
  form: ContractForm;
  contractId: number | null;
  contracts: readonly Listed[];
  now: Date;
}) {
  const self = contractId ?? -1;
  return inForceOf(
    [
      ...contracts.filter((contract) => contract.id !== self),
      {
        id: self,
        name: form.name,
        description: [],
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      },
    ],
    now,
  );
}

const isBlank = (row: PointRow) =>
  !row.point.trim() && !row.subtext.trim() && !row.adminNotes.trim();

export function errorsOf(
  form: ContractForm,
  {
    contractId,
    contracts,
    datesChanged,
    now,
  }: {
    /** Null for a new contract. */
    contractId: number | null;
    contracts: readonly Listed[] | null;
    datesChanged: boolean;
    now: Date;
  },
): ContractErrors {
  const errors: ContractErrors = {};
  if (contractId === null && !form.markdown.trim())
    errors.markdown = "Enter the text members sign";
  const points = Object.fromEntries(
    form.points
      .filter((row) => !row.point.trim() && !isBlank(row))
      .map((row) => [row.key, "Enter the point, or remove it"]),
  );
  if (Object.keys(points).length > 0) errors.points = points;
  // Both member apps refuse to show a contract with no points at joining. With
  // the list unknown, any started one might be in force.
  const scheduled = !!form.startDate && new Date(form.startDate) > now;
  const inForce =
    !contracts ||
    afterSaveOf({ form, contractId, contracts, now })?.id ===
      (contractId ?? -1);
  const ended = form.endDate !== "" && new Date(form.endDate) <= now;
  if (
    form.startDate &&
    !ended &&
    (scheduled || inForce) &&
    form.points.every(isBlank)
  )
    errors.noPoints =
      "Add a point: nobody can join while the contract they sign has none";
  const takeover = takeoverOf({
    form,
    contractId,
    contracts,
    datesChanged,
    now,
  });
  if (takeover === null)
    errors.schedule =
      "Couldn't load the other contracts to check which one members sign after this change. Reload the page and try again.";
  else if (takeover && takeover.description.length === 0)
    errors.schedule = `“${contractName(takeover)}” has no points, and nobody can join while the contract they sign has none. Add points to it first.`;
  if (
    form.startDate &&
    form.endDate &&
    new Date(form.endDate) <= new Date(form.startDate)
  )
    errors.endDate = "Pick an end after the start, or leave it empty";
  return errors;
}

/**
 * Another contract the new dates put in force, now or at a new end date; null
 * while the list is unknown, undefined when there is none.
 */
function takeoverOf({
  form,
  contractId,
  contracts,
  datesChanged,
  now,
}: {
  form: ContractForm;
  contractId: number | null;
  contracts: readonly Listed[] | null;
  datesChanged: boolean;
  now: Date;
}): Listed | null | undefined {
  if (!datesChanged || contractId === null) return undefined;
  if (!contracts) return null;
  const others = contracts.filter((contract) => contract.id !== contractId);
  const after = afterSaveOf({ form, contractId, contracts, now });
  if (after && after.id !== contractId)
    return after.id === inForceOf(contracts, now)?.id ? undefined : after;
  const end = form.endDate ? new Date(form.endDate) : null;
  return (after && end && end > now && inForceOf(others, end)) || undefined;
}

export const hasErrors = (errors: ContractErrors) =>
  Object.keys(errors).length > 0;

/**
 * What a save sends. Rows left entirely blank are dropped. An empty date goes
 * as `null`, which clears a stored one: left out, the server keeps the old date.
 */
export function saveBodyOf(form: ContractForm) {
  const body = {
    name: form.name.trim(),
    description: form.points
      .filter((row) => !isBlank(row))
      .map((row) => ({
        point: row.point.trim(),
        subtext: row.subtext.trim(),
        adminNotes: row.adminNotes.trim(),
      })),
    startDate: form.startDate || null,
    endDate: form.endDate || null,
  } satisfies UpdateContractDto;
  return {
    update: body,
    create: { ...body, markdown: form.markdown } satisfies CreateContractDto,
  };
}

/** The points as members get them: no admin notes, no blank rows. */
export const memberPointsOf = (form: ContractForm) =>
  saveBodyOf(form).update.description.map(({ point, subtext }) => ({
    point,
    subtext,
  }));

export const JOIN_PATHS = "when they join or on their Membership page";

/**
 * What saving the form as it stands changes about which contract members sign:
 * the one in force now against the one in force after the save, worked out
 * from the list with this contract's dates swapped in, and at a new end date.
 * `contracts` is null while the list is unknown.
 */
export function saveNoteOf({
  form,
  contractId,
  contracts,
  activeId,
  pointsChanged,
  now,
}: {
  form: ContractForm;
  /** Null for a new contract. */
  contractId: number | null;
  contracts: readonly Listed[] | null;
  activeId: number | null;
  /** Members see the points, but not the name or dates. */
  pointsChanged: boolean;
  now: Date;
}): string {
  const self = contractId ?? -1;
  const start = form.startDate ? new Date(form.startDate) : null;
  const end = form.endDate ? new Date(form.endDate) : null;
  const after = contracts && afterSaveOf({ form, contractId, contracts, now });
  const signedBy =
    contractId !== null && pointsChanged
      ? "Members who signed this contract see the new points too, without signing again."
      : "";
  const join = (...sentences: string[]) => sentences.filter(Boolean).join(" ");

  const prompted = (name: string) =>
    `Members on a contract other than ${name} then see “An updated agreement is available” on their Membership page.`;

  if (after?.id === self && activeId !== self)
    return join(
      "On save, members are asked to sign this contract and the public site quotes it.",
      prompted("this one"),
    );
  if (after?.id === self) {
    const reach = pointsChanged
      ? "A save reaches members and the public site on their next load."
      : "";
    const savedEnd = contracts?.find(
      (contract) => contract.id === self,
    )?.endDate;
    if (!end || !contracts || instantOf(savedEnd) === form.endDate)
      return join(reach, signedBy);
    const next = inForceOf(
      contracts.filter((contract) => contract.id !== self),
      end,
    );
    return join(
      reach,
      signedBy,
      ...(next
        ? [
            `From its end date, members are asked to sign “${contractName(next)}” instead.`,
            prompted(`“${contractName(next)}”`),
          ]
        : [
            "From its end date, no contract is in force, so new members have none to sign when they join.",
          ]),
    );
  }

  const handover =
    !contracts || activeId !== self
      ? ""
      : after
        ? join(
            `On save, members are asked to sign “${contractName(after)}” instead and the public site quotes it.`,
            prompted(`“${contractName(after)}”`),
          )
        : "On save, no contract is in force, so new members have none to sign when they join.";
  // A task form's contract field signs whatever contract it names, dates aside.
  const taskForms =
    contractId === null ? "" : " A task form that names it still asks.";
  const status = !start
    ? `No start date, so members aren't asked to sign it ${JOIN_PATHS}.${taskForms}`
    : end && end <= now
      ? `Past its end date, so members aren't asked to sign it ${JOIN_PATHS}.${taskForms}`
      : start > now
        ? `Members are asked to sign it ${JOIN_PATHS} from its start date until ${end ? "its end date or " : ""}a contract with a later start begins.`
        : handover
          ? ""
          : after
            ? `“${contractName(after)}” started later, so members sign that one instead.`
            : "Started, so members may be asked to sign it.";
  return join(status, handover, signedBy);
}
