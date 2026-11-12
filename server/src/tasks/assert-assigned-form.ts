import { ForbiddenException } from "@nestjs/common";
import type { ActionFormVariantService } from "src/actions/action-form-variant.service";

export async function assertAssignedForm(
  actionFormVariantService: ActionFormVariantService,
  params: { actionId: number; userId: number; formId: number },
): Promise<void> {
  if (!(await actionFormVariantService.validateFormIdForUser(params))) {
    throw new ForbiddenException(
      "This form is not the variant assigned to you for this action",
    );
  }
}
