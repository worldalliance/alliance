import { type FormSchema } from "@alliance/common/forms/form-schema";
import { type FormResponseDto, type UserDto } from "@alliance/shared/client";
import {
  aggregateTarget,
  useVariableAggregates,
} from "@alliance/shared/forms/useVariableAggregates";
import {
  historySubject,
  useVariableSourceHistories,
} from "@alliance/shared/forms/useVariableSourceHistories";
import { useVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import {
  useCurrentUserLocation,
  usePreviousAnswerSources,
  useVisibilityValidatorResults,
} from "@alliance/shared/useFormRenderer";

export function useFormInputs({
  schema,
  formId,
  formSnapshotId,
  readOnly,
  user,
  userLoading,
  adminPreviewUserId,
  completedFormResponse,
  loadUserLocation,
}: {
  schema: FormSchema;
  formId: number;
  formSnapshotId: number | null;
  readOnly: boolean;
  user?: Omit<UserDto, "email">;
  userLoading: boolean;
  adminPreviewUserId?: string | number;
  completedFormResponse?: FormResponseDto;
  loadUserLocation: boolean;
}) {
  const userLocation = useCurrentUserLocation({
    enabled: loadUserLocation,
    user,
  });

  const visibilityContext = useVisibilityContext(schema, {
    enabled: !!user,
  });

  const visibilityValidators = useVisibilityValidatorResults({
    schema,
    readOnly,
    savedResults: completedFormResponse?.visibilityValidatorResults,
    signedIn: !!user || adminPreviewUserId !== undefined,
  });

  const previousAnswers = usePreviousAnswerSources({
    schema,
    previewUserId: adminPreviewUserId,
    signedIn: !!user,
  });

  const sourceHistories = useVariableSourceHistories({
    schema,
    subject: historySubject({
      adminPreviewUserId,
      signedIn: !!user,
      userLoading,
    }),
  });

  const variableAggregates = useVariableAggregates({
    schema,
    target: aggregateTarget({
      admin: adminPreviewUserId !== undefined,
      formId,
      formSnapshotId,
    }),
  });

  return {
    userLocation,
    visibilityContext,
    visibilityValidators,
    previousAnswers,
    sourceHistories,
    variableAggregates,
  };
}
