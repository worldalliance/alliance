// eslint-disable-next-line api-client/named-hooks-only -- a verdict reflects the member's live profile, so no query cache holds it
import {
  customValidatorRunValidator,
  customValidatorRunValidatorAsUserAdmin,
} from "../client";
import { previewedMemberId } from "./previewedMemberId";

/**
 * Runs for the member an admin previews as, or for the caller when there's
 * no preview or it's the builder's "preview" stand-in, which isn't a user.
 */
export const runCustomValidator = ({
  validatorId,
  fieldValue,
  previewUserId,
}: {
  validatorId: number;
  fieldValue?: string;
  previewUserId?: string | number | null;
}) => {
  const memberId = previewedMemberId(previewUserId);
  return memberId === null
    ? customValidatorRunValidator({
        path: { id: validatorId },
        body: { fieldValue },
      })
    : customValidatorRunValidatorAsUserAdmin({
        path: { id: validatorId, userId: memberId },
        body: { fieldValue },
      });
};
