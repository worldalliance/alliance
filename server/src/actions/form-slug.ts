import { ConflictException } from "@nestjs/common";
import { updateLive } from "src/datasources/soft-delete";
import { Form } from "src/tasks/entities/form.entity";
import { slugCandidates } from "src/utils/slug";
import type { EntityManager } from "typeorm";
import { lockActionRow } from "./lock-action-row";

export enum FormSlugSequence {
  Main = "v",
  FollowUp = "f",
}

/** Null for a form that belongs to no action. */
export type FormPlacement = {
  actionId: number;
  sequence: FormSlugSequence;
} | null;

export type FormOwner = { formId: number; actionSlug: string };

const LIVE_FORM_OWNERS = `
  SELECT a."taskFormId" AS "formId", a.id AS "actionId", a.slug AS "actionSlug", 0 AS rank
    FROM action a WHERE a."deletedAt" IS NULL AND a."taskFormId" IS NOT NULL
  UNION ALL
  SELECT v."formId", a.id, a.slug, 1
    FROM action_form_variant v JOIN action a ON a.id = v."actionId"
    WHERE v."deletedAt" IS NULL AND a."deletedAt" IS NULL
  UNION ALL
  SELECT b."formId", a.id, a.slug, 1
    FROM action_branch b JOIN action a ON a.id = b."actionId"
    WHERE b."deletedAt" IS NULL AND a."deletedAt" IS NULL
  UNION ALL
  SELECT f."formId", a.id, a.slug, 2
    FROM follow_up_form f JOIN action a ON a.id = f."actionId"
    WHERE f."deletedAt" IS NULL AND a."deletedAt" IS NULL`;

export const orphanFormSlug = (formId: number): string => formId.toString(36);

export function isDefaultOrphanSlug(form: Pick<Form, "id" | "slug">): boolean {
  return new RegExp(`^${orphanFormSlug(form.id)}(-\\d+)?$`).test(form.slug);
}

const SEQUENCE_SLUG = new RegExp(
  `^(${Object.values(FormSlugSequence).join("|")})\\d+$`,
);

/** A slug the server picked rather than one staff chose: a sequence number or the no-action default. */
export function isSystemAssignedSlug(form: Pick<Form, "id" | "slug">): boolean {
  return SEQUENCE_SLUG.test(form.slug) || isDefaultOrphanSlug(form);
}

export function nextSequenceSlug(
  sequence: FormSlugSequence,
  taken: readonly string[],
): string {
  const pattern = new RegExp(`^${sequence}(\\d+)$`);
  const numbers = taken.map((slug) => Number(pattern.exec(slug)?.[1] ?? 0));
  return `${sequence}${Math.max(0, ...numbers) + 1}`;
}

export function displayFormSlug(input: {
  slug: string;
  actionSlug: string | undefined;
}): string {
  return input.actionSlug === undefined
    ? input.slug
    : `${input.actionSlug}::${input.slug}`;
}

/** Task forms win over variants, and variants over follow-ups, for a form in more than one. */
export async function findFormOwners(
  em: EntityManager,
  formIds: readonly number[],
): Promise<Map<number, FormOwner>> {
  if (formIds.length === 0) return new Map();
  const rows: FormOwner[] = await em.query(
    `SELECT DISTINCT ON ("formId") "formId", "actionSlug"
       FROM (${LIVE_FORM_OWNERS}) o
       WHERE "formId" = ANY($1)
       ORDER BY "formId", rank`,
    [formIds],
  );
  return new Map(rows.map((row) => [row.formId, row]));
}

async function ownerActionId(
  em: EntityManager,
  formId: number,
): Promise<number | null> {
  const [row]: { actionId: number }[] = await em.query(
    `SELECT "actionId" FROM (${LIVE_FORM_OWNERS}) o WHERE "formId" = $1 ORDER BY rank LIMIT 1`,
    [formId],
  );
  return row?.actionId ?? null;
}

async function takenSlugs(
  em: EntityManager,
  params: { actionId: number | null; exceptFormId: number | null },
): Promise<string[]> {
  const live = `SELECT slug FROM form WHERE "deletedAt" IS NULL AND id IS DISTINCT FROM $1::int`;
  const owned = `SELECT "formId" FROM (${LIVE_FORM_OWNERS}) o`;
  const rows: { slug: string }[] =
    params.actionId === null
      ? await em.query(`${live} AND id NOT IN (${owned})`, [
          params.exceptFormId,
        ])
      : await em.query(`${live} AND id IN (${owned} WHERE "actionId" = $2)`, [
          params.exceptFormId,
          params.actionId,
        ]);
  return rows.map((row) => row.slug);
}

function freeCandidate(base: string, taken: readonly string[]): string {
  for (const candidate of slugCandidates(base)) {
    if (!taken.includes(candidate)) return candidate;
  }
  throw new Error("unreachable: slugCandidates is infinite");
}

function assertSlugFree(slug: string, taken: readonly string[]): void {
  if (taken.includes(slug)) {
    throw new ConflictException(`The slug "${slug}" is already taken`);
  }
}

/** Takes the action row lock. */
export async function insertForm(
  em: EntityManager,
  params: {
    form: Pick<Form, "title" | "formSnapshotId"> & Partial<Form>;
    placement: FormPlacement;
  },
): Promise<Form> {
  const { placement } = params;
  const repo = em.getRepository(Form);
  if (placement !== null) {
    await lockActionRow(em, placement.actionId);
    const taken = await takenSlugs(em, {
      actionId: placement.actionId,
      exceptFormId: null,
    });
    return repo.save(
      repo.create({
        ...params.form,
        id: undefined,
        slug: nextSequenceSlug(placement.sequence, taken),
      }),
    );
  }
  const form = await repo.save(
    repo.create({ ...params.form, id: undefined, slug: "" }),
  );
  const taken = await takenSlugs(em, { actionId: null, exceptFormId: form.id });
  form.slug = freeCandidate(orphanFormSlug(form.id), taken);
  await repo.update(form.id, { slug: form.slug });
  return form;
}

/**
 * Call once the form is linked to the action. A form with a system-assigned
 * slug takes the next number in the sequence; one staff renamed keeps its slug,
 * which must be free in the action.
 */
export async function slugFormForAction(
  em: EntityManager,
  params: { formId: number; actionId: number; sequence: FormSlugSequence },
): Promise<void> {
  await lockActionRow(em, params.actionId);
  const form = await em.getRepository(Form).findOneOrFail({
    where: { id: params.formId },
    select: { id: true, slug: true },
  });
  const taken = await takenSlugs(em, {
    actionId: params.actionId,
    exceptFormId: form.id,
  });
  if (!isSystemAssignedSlug(form)) {
    assertSlugFree(form.slug, taken);
    return;
  }
  await em.getRepository(Form).update(form.id, {
    slug: nextSequenceSlug(params.sequence, taken),
  });
}

export async function renameFormSlug(
  em: EntityManager,
  params: { formId: number; slug: string },
): Promise<void> {
  const actionId = await ownerActionId(em, params.formId);
  if (actionId !== null) await lockActionRow(em, actionId);
  assertSlugFree(
    params.slug,
    await takenSlugs(em, { actionId, exceptFormId: params.formId }),
  );
  await updateLive(em, {
    target: Form,
    id: params.formId,
    changes: { slug: params.slug },
    notFound: "Form not found",
  });
}
