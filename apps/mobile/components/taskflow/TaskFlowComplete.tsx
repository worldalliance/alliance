import {
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type UserDto } from "@alliance/shared/client";
import { formatUserLocationDisplayValue } from "@alliance/shared/formrenderer";
import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { useCurrentUserLocation } from "@alliance/shared/forms/useCurrentUserLocation";
import { taskFlow } from "@alliance/shared/lib/copy";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OutputRenderer from "../OutputRenderer";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";
import FlowButton from "./FlowButton";

export default function TaskFlowComplete({
  schema,
  answers,
  user,
  onClose,
  onInvite,
}: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  user?: Omit<UserDto, "email">;
  onClose: () => void;
  onInvite: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { userLocationDisplayValue } = useCurrentUserLocation({
    enabled: !!user,
    user,
  });
  const location = formatUserLocationDisplayValue(userLocationDisplayValue);

  return (
    <View className="flex-1 bg-green" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 48 }}>
        <Text accessibilityRole="header" className="text-4xl text-white">
          {taskFlow.complete}
        </Text>
        <Text className="text-base text-white mt-3">
          {taskFlow.completeUpdate}
        </Text>
        <View className="mt-6 rounded-md bg-white p-6 gap-y-4">
          {user ? (
            <View className="flex-row items-center gap-x-3">
              <ProfileImage pfp={user.profilePicture} size="medium" />
              <View className="flex-1">
                <Text
                  className="text-base text-zinc-900"
                  weight={FontWeight.Semibold}
                >
                  {user.name}
                </Text>
                {location ? (
                  <Text className="text-base text-zinc-500">{location}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
          <OutputRenderer schema={schema} answers={answers} ownView />
        </View>
      </ScrollView>
      <View
        className="px-4 pt-4 gap-y-3"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <FlowButton
          kind={FlowButtonKind.Inverse}
          onPress={onClose}
          title={taskFlow.closeTask}
        />
        <FlowButton
          kind={FlowButtonKind.Secondary}
          onPress={onInvite}
          title={taskFlow.inviteFriend}
        />
      </View>
    </View>
  );
}
