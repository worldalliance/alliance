import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import type { FormSnapshotService } from "src/tasks/formsnapshot.service";
import type { EntityManager } from "typeorm";
import { ActionEvent } from "./entities/action-event.entity";
import type { Action } from "./entities/action.entity";
import { FormSlugSequence, insertForm } from "./form-slug";

/** The form a new variant or branch copies: `sourceFormId`, or else the action's task form. */
export async function findSourceForm(
  em: EntityManager,
  params: { action: Pick<Action, "taskFormId">; sourceFormId?: number | null },
): Promise<Form> {
  const sourceFormId = params.sourceFormId ?? params.action.taskFormId;
  if (sourceFormId == null) {
    throw new BadRequestException(
      "Action has no form to clone. Set the action form first or pass sourceFormId.",
    );
  }
  const sourceForm = await em.findOne(Form, {
    where: { id: sourceFormId },
    relations: { formSnapshot: true },
  });
  if (!sourceForm) throw new NotFoundException("Source form not found");
  return sourceForm;
}

/** A copy of `sourceForm` placed on the action, for a new variant or branch. */
export async function cloneFormIntoAction(
  em: EntityManager,
  params: {
    sourceForm: Form;
    actionId: number;
    formSnapshotService: FormSnapshotService;
  },
): Promise<Form> {
  const { sourceForm, actionId, formSnapshotService } = params;
  const newForm = await insertForm(em, {
    form: {
      title: sourceForm.title,
      formSnapshotId: sourceForm.formSnapshotId,
      formSnapshot: sourceForm.formSnapshot,
    },
    placement: { actionId, sequence: FormSlugSequence.Main },
  });
  await formSnapshotService.recordHistorical({
    owner: SnapshotHistoryOwner.Form,
    ownerId: newForm.id,
    snapshotId: sourceForm.formSnapshotId,
    em,
  });
  return newForm;
}

/**
 * Whether a variant's or branch's assignments can be deleted with it: the
 * action hasn't launched and nobody answered its form. Clients only submit
 * once member_action starts, so a response means members were assigned after
 * a launch whose member_action event later moved or was deleted.
 */
export async function isUnlaunchedAndUnanswered(
  em: EntityManager,
  params: { actionId: number; formId: number },
): Promise<boolean> {
  const events = await em.findBy(ActionEvent, {
    action: { id: params.actionId },
  });
  return (
    !hasMemberActionStarted(events, new Date()) &&
    !(await em.existsBy(FormResponse, { formId: params.formId }))
  );
}
