import React from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { SimplePageTitle } from "./SimplePageTitle";

type ScreenWithLoadingProps = {
  title: string;
  loading: boolean;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * Full-screen layout with title, optional header right, and either a loading spinner or content.
 */
export function ScreenWithLoading({
  title,
  loading,
  headerRight,
  children,
}: ScreenWithLoadingProps) {
  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title={title}>{headerRight}</SimplePageTitle>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        children
      )}
    </View>
  );
}
