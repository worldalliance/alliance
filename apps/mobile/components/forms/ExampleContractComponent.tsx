import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { formatShortDate } from "@alliance/shared/lib/dateFormatters";
import { CardStyle } from "@alliance/shared/styles/card";
import { View } from "react-native";
import Card from "../system/Card";
import Checkbox from "../system/Checkbox";
import Text, { FontWeight } from "../system/Text";

const ExampleContractComponent = ({
  user,
  onChange,
  value,
  disabled,
}: CustomComponentProps) => {
  const signedAt = user?.contractEvents?.[0]?.date;
  const signedDate = signedAt ? formatShortDate(new Date(signedAt)) : null;

  return (
    <Card cardStyle={CardStyle.Grey}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3">
          {signedDate ? (
            <>
              Your contract was signed on:{" "}
              <Text weight={FontWeight.Bold}>{signedDate}</Text>
            </>
          ) : (
            "No contract on file"
          )}
        </Text>
        <Checkbox
          checked={value === "true"}
          onChange={(next) => onChange(next ? "true" : "false")}
          disabled={disabled}
        />
      </View>
    </Card>
  );
};

export default ExampleContractComponent;
