import { cn } from "@alliance/shared/styles/util";
import { forwardRef } from "react";
import {
  // eslint-disable-next-line no-restricted-imports
  KeyboardAwareScrollView as BaseKeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
  KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

const KeyboardAwareScrollView = forwardRef<
  KeyboardAwareScrollViewRef,
  KeyboardAwareScrollViewProps
>((props, ref) => {
  const { className, ...rest } = props;
  const tabBarHeight = 130;
  return (
    <BaseKeyboardAwareScrollView
      ref={ref}
      className={cn("flex-1", className)}
      keyboardShouldPersistTaps="handled"
      bottomOffset={tabBarHeight}
      {...rest}
    />
  );
});

KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView";

export default KeyboardAwareScrollView;
