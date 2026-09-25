import { FormSchema } from "@alliance/common/forms/form-schema";
import { tasksGetForm } from "@alliance/shared/client";
import type {
  FollowUpFormDto,
  SubmitFormDto,
} from "@alliance/shared/client/types.gen";
import {
  followUpDraftStorageKey,
  followUpFormIntro,
  followUpPersistKey,
  submitFollowUpForm,
} from "@alliance/shared/lib/followUpForm";
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
      const submitted = await submitFollowUpForm({
        followUpFormId: followUpForm.id,
        actionId,
        data,
      });
      if (!submitted.ok) {
        setError("Failed to submit. Please try again.");
        return;
      }
      if (form) {
        await AsyncStorage.removeItem(
          followUpDraftStorageKey({
            formId: form.id,
            followUpFormId: followUpForm.id,
          }),
        );
      }
      Alert.alert("Response submitted", "Thank you!");
      setFormInstanceKey((k) => k + 1);
      onSubmitted?.();
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

  const intro = followUpFormIntro(followUpForm, form.title);

  return (
    <Card cardStyle={CardStyle.White} className="p-4">
      {intro.shown && (
        <Card cardStyle={CardStyle.Alert} className="mb-3 border-0 rounded-lg">
          <Text weight={FontWeight.Semibold}>{intro.title}</Text>
          {intro.hasInstructions && (
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
          persistKey={followUpPersistKey(followUpForm.id)}
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
