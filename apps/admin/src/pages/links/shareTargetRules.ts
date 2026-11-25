import { R, type Result } from "@alliance/common/result";
import { appendQueryParam, isValidHttpUrl } from "@alliance/common/url";
import type {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
} from "@alliance/shared/client/types.gen";

export type ShareTargetErrors = Partial<
  Record<keyof CreateExternalShareTargetDto, string>
>;

export const EMPTY_SHARE_TARGET: CreateExternalShareTargetDto = {
  name: "",
  url: "",
  paramName: "",
};

/** The trimmed values, or what to fix, by field. */
export function validateShareTarget(
  values: CreateExternalShareTargetDto,
): Result<CreateExternalShareTargetDto, ShareTargetErrors> {
  const name = values.name.trim();
  const url = values.url.trim();
  const paramName = values.paramName.trim();
  const errors: ShareTargetErrors = {};
  if (!name) errors.name = "Enter a name";
  if (!isValidHttpUrl(url))
    errors.url = "Enter a valid http:// or https:// URL";
  if (!paramName) errors.paramName = "Enter a parameter name";
  return Object.keys(errors).length > 0
    ? R.failure(errors)
    : R.success({ name, url, paramName });
}

const SAMPLE_CODE = "1a2b3c4d5e";

/** A member's link to the target, with a sample code; null until both parts are valid. */
export const exampleShareLink = (
  values: Pick<ExternalShareTargetDto, "url" | "paramName">,
): string | null => {
  const paramName = values.paramName.trim();
  return isValidHttpUrl(values.url) && paramName
    ? appendQueryParam(values.url, paramName, SAMPLE_CODE)
    : null;
};
