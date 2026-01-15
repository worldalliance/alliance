import { ReactNode } from "react";
import { View } from "react-native";

interface GreenHeaderProps {
  /** Main content - should include a scrollable view with green header content at the top */
  children: ReactNode;
}

/**
 * Wrapper component that provides proper overscroll behavior for pages with green headers:
 * - Green overscroll when pulling down at the top
 * - White overscroll when scrolling past the bottom
 *
 * Children should typically be a ScrollView or LegendList that starts with
 * a green header section (using bg-green).
 */
export default function GreenHeader({ children }: GreenHeaderProps) {
  return (
    <View className="bg-green flex-1">
      {/* Main content area - z-10 to appear above the white bottom layer */}
      <View className="flex-1 z-10">{children}</View>
      {/* White layer for bottom overscroll - positioned behind content */}
      <View className="bg-white absolute bottom-0 left-0 right-0 h-[300px] z-0" />
    </View>
  );
}
