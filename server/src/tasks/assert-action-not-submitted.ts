import { FORM_ALREADY_SUBMITTED } from "@alliance/common/actionActivity";
import { BadRequestException } from "@nestjs/common";
import type { ActionFormAssignmentService } from "src/actions/action-form-assignment.service";

export async function assertActionNotSubmitted(
  actionFormAssignmentService: ActionFormAssignmentService,
  params: { actionId: number; userId: number },
): Promise<void> {
  if (await actionFormAssignmentService.hasSubmittedAssignedForm(params)) {
    throw new BadRequestException(FORM_ALREADY_SUBMITTED);
  }
}
