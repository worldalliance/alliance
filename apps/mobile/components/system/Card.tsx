import {
  CardStyle,
  mobileCardStyleClasses,
} from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import React from "react";
import {
  ImageBackground,
  ImageSourcePropType,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";
export { CardStyle } from "@alliance/shared/styles/card";

interface CardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  cardStyle?: CardStyle;
  onPress?: () => void;
  backgroundImage?: ImageSourcePropType;
}

export default function Card({
  children,
  className,
  cardStyle = CardStyle.White,
  onPress,
  backgroundImage,
  ...props
}: CardProps) {
  const baseClasses = "flex flex-col p-4 rounded-lg";
  const variantClasses = mobileCardStyleClasses[cardStyle];
  const combinedClasses = cn(baseClasses, variantClasses, className);

  if (backgroundImage && cardStyle === CardStyle.Image) {
    return (
      <ImageBackground
        source={backgroundImage}
        className={combinedClasses}
        imageStyle={{ borderRadius: 8 }}
      >
        {children}
      </ImageBackground>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        className={combinedClasses}
        onPress={onPress}
        activeOpacity={0.95}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={combinedClasses} {...props}>
      {children}
    </View>
  );
}
