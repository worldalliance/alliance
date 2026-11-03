import { type UserDto } from "@alliance/shared/client";
import { formatUserLocationDisplayValue } from "@alliance/shared/formrenderer";
import { useCurrentUserLocation } from "@alliance/shared/forms/useCurrentUserLocation";
import { cn } from "@alliance/shared/styles/util";
import {
  useOutputItems,
  type OutputSource,
} from "@alliance/shared/useOutputItems";
import { View, type ViewProps } from "react-native";
import OutputRenderer from "../OutputRenderer";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";

/** The member's own answers through the form's output view; nothing when it shows nothing. */
export default function TaskAnswersCard({
  output,
  user,
  className,
  ...props
}: ViewProps & {
  output: Omit<OutputSource, "ownView">;
  user: Omit<UserDto, "email"> | undefined;
}) {
  const source = { ...output, ownView: true };
  const outputItems = useOutputItems(source);
  const { userLocationDisplayValue } = useCurrentUserLocation({
    enabled: !!user && outputItems.length > 0,
    user,
  });
  const location = formatUserLocationDisplayValue(userLocationDisplayValue);
  if (outputItems.length === 0) return null;

  return (
    <View
      className={cn("rounded-md bg-white p-6 gap-y-4", className)}
      {...props}
    >
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
      <OutputRenderer {...source} />
    </View>
  );
}
