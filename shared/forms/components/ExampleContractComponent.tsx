import type { CustomComponentProps } from "./types";
import Card, { CardStyle } from "../../ui/Card";

const ExampleContractComponent = ({
  user,
  onChange,
  value,
}: CustomComponentProps) => {
  return (
    <Card style={CardStyle.Grey}>
      <div className="flex flex-row justify-between items-center">
        <p>
          Your contract was signed on:{" "}
          <b>
            {new Date(
              user?.contractEvents?.[0]?.date ?? new Date()
            ).toLocaleDateString()}
          </b>
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
