import { Redirect, usePathname } from "expo-router";
import { View } from "react-native";
import Text from "../../components/system/Text";

export default function NotFound() {
  const pathname = usePathname();
  if (__DEV__)
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="mb-2">{pathname}</Text>
        <Text>Not found :(</Text>
      </View>
    );

  return <Redirect href="/" />;
}
