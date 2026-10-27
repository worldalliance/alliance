import { FORM_ALREADY_SUBMITTED } from "@alliance/common/actionActivity";
import { BadRequestException } from "@nestjs/common";
import type { ActionFormVariantService } from "src/actions/action-form-variant.service";

export async function assertActionNotSubmitted(
  actionFormVariantService: ActionFormVariantService,
  params: { actionId: number; userId: number },
): Promise<void> {
  const submitted = await actionFormVariantService.findSubmittedFormIds({
    actionIds: [params.actionId],
    userId: params.userId,
  });
  if (submitted.has(params.actionId)) {
    throw new BadRequestException(FORM_ALREADY_SUBMITTED);
  }
}
