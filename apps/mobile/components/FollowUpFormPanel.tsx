import { ExceptionEvent } from "@alliance/common/analytics";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { tasksGetForm, tasksSubmitFollowUpForm } from "@alliance/shared/client";
import type {
  FollowUpFormDto,
  SubmitFollowUpFormDto,
  SubmitFormDto,
} from "@alliance/shared/client/types.gen";
import { computeFormStorageKey } from "@alliance/shared/formrenderer";
import { captureException } from "@alliance/shared/lib/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { colors } from "../lib/style/colors";
import AppMarkdownWrapper from "./AppMarkdownWrapper";
import FormRenderer from "./forms/FormRenderer";
import Card, { CardStyle } from "./system/Card";
import Text, { FontWeight } from "./system/Text";

interface FollowUpFormPanelProps {
  followUpForm: FollowUpFormDto;
  actionId: number;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  onSubmitted?: () => void;
}

export default function FollowUpFormPanel({
  followUpForm,
  actionId,
  scrollPageTo,
  scrollToEnd,
  onSubmitted,
}: FollowUpFormPanelProps) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [formInstanceKey, setFormInstanceKey] = useState(0);

  const {
    data: form,
    error: formError,
    isPending,
  } = useQuery({
    queryKey: ["form", followUpForm.formId],
    queryFn: () =>
      tasksGetForm({ path: { id: followUpForm.formId } }).then(
        (response) => response.data,
      ),
  });

  const handleSubmit = useCallback(
    async (data: SubmitFormDto) => {
      setError(null);
      const body: SubmitFollowUpFormDto = {
        answers: data.answers,
        formSnapshotId: data.formSnapshotId,
        visibilityValidatorResults: data.visibilityValidatorResults,
        deviceType: data.deviceType,
        publicAnswers: data.publicAnswers,
        phDistinctId: data.phDistinctId,
        sessionReplayUrl: data.sessionReplayUrl,
        sid: data.sid,
      };
      const response = await tasksSubmitFollowUpForm({
        path: { followUpFormId: followUpForm.id },
        body,
      });
      if (response.response.ok) {
        if (form) {
          const storageKey = computeFormStorageKey({
            formId: form.id,
            instanceId: `follow-up-${followUpForm.id}`,
          });
          await AsyncStorage.removeItem(storageKey);
        }
        Alert.alert("Response submitted", "Thank you!");
        setFormInstanceKey((k) => k + 1);
        onSubmitted?.();
      } else {
        console.error(response.error);
        captureException(
          ExceptionEvent.FollowUpFormSubmitError,
          response.error,
          {
            actionId,
            followUpFormId: followUpForm.id,
          },
        );
        setError("Failed to submit. Please try again.");
      }
    },
    [followUpForm.id, form, actionId, onSubmitted],
  );

  if (isPending) {
    return (
      <View className="items-center justify-center p-6">
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!form) {
    return (
      <View className="items-center justify-center p-6">
        <Text className="text-red-500">
          {formError?.message ?? error ?? "Error loading form"}
        </Text>
      </View>
    );
  }

  const formTitle = followUpForm.name ?? form.title;
  const hasInstructions =
    followUpForm.instructions != null &&
    followUpForm.instructions.trim() !== "";
  const showIntroCard = hasInstructions || !!formTitle;

  return (
    <Card cardStyle={CardStyle.White} className="p-4">
      {showIntroCard && (
        <Card cardStyle={CardStyle.Alert} className="mb-3 border-0 rounded-lg">
          <Text weight={FontWeight.Semibold}>{formTitle}</Text>
          {hasInstructions && (
            <View className="mt-1">
              <AppMarkdownWrapper
                markdownContent={followUpForm.instructions ?? ""}
              />
            </View>
          )}
        </Card>
      )}
      <View>
        <FormRenderer
          key={formInstanceKey}
          form={form.schema as unknown as FormSchema}
          id={form.id}
          formSnapshotId={form.formSnapshotId}
          actionId={actionId}
          onSubmit={handleSubmit}
          persistKey={`follow-up-${followUpForm.id}`}
          userId={user?.id}
          user={user}
          loadCurrentUserLocation={!!user}
          onFormStarted={() => {}}
          renderFormAsCompleted={false}
          scrollPageTo={scrollPageTo}
          scrollToEnd={scrollToEnd}
        />
      </View>
      {error && (
        <View className="mt-4 p-3 bg-red-50 rounded-lg">
          <Text className="text-red-500">{error}</Text>
        </View>
      )}
    </Card>
  );
}
