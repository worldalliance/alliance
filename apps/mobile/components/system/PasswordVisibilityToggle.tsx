import { Eye, EyeOff } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { colors } from "../../lib/style/colors";

interface PasswordVisibilityToggleProps {
  visible: boolean;
  onPress: () => void;
}

export default function PasswordVisibilityToggle({
  visible,
  onPress,
}: PasswordVisibilityToggleProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
      hitSlop={8}
    >
      {visible ? (
        <EyeOff size={18} color={colors.text.icon} />
      ) : (
        <Eye size={18} color={colors.text.icon} />
      )}
    </TouchableOpacity>
  );
}
