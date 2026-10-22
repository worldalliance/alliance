import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { formatCurrentSigningDate } from "@alliance/shared/lib/contract";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "../../ui/Card";

const ExampleContractComponent = ({
  user,
  onChange,
  value,
}: CustomComponentProps) => {
  const signedDate = formatCurrentSigningDate(user?.lastContractEvent);

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
