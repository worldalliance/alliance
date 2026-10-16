import { useCustomValidatorAdmin } from "../../lib/useCustomValidatorAdmin";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "./customValidatorDrafts";

/** The settings a validator id stands for: an unsaved draft's from the
 * editor, a saved validator's from the server. */
export function useValidatorConfig(id: number | undefined) {
  const { drafts } = useCustomValidatorDrafts();
  const isDraft = isDraftValidatorId(id);
  const saved = useCustomValidatorAdmin(id && !isDraft ? id : null).query;
  const config = !id ? undefined : isDraft ? drafts[id] : saved.data;
  return { config, isDraft, saved };
}
