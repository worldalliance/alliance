import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { formatShortDate } from "@alliance/shared/lib/dateFormatters";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "../../ui/Card";

const ExampleContractComponent = ({
  user,
  onChange,
  value,
}: CustomComponentProps) => {
  const signedAt = user?.contractEvents?.[0]?.date;
  const signedDate = signedAt ? formatShortDate(new Date(signedAt)) : null;

  return (
    <Card style={CardStyle.Grey}>
      <div className="flex flex-row justify-between items-center">
        <p>
          {signedDate ? (
            <>
              Your contract was signed on: <b>{signedDate}</b>
            </>
          ) : (
            "No contract on file"
          )}
        </p>
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(event) =>
            onChange(event.target.checked ? "true" : "false")
          }
        />
      </div>
    </Card>
  );
};

export default ExampleContractComponent;
