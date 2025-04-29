import { ProgressCircle } from "./tremor/ProgressCircle";
import Card, { CardStyle } from "./system/Card";
import UserBubbleRow from "./UserBubbleRow";
import Button, { ButtonColor } from "./system/Button";
const PokePanel = () => {
  return (
    <Card style={CardStyle.Grey} className="text-[11pt]">
      <div className="flex flex-row gap-8 justify-between">
        <div className="flex flex-col gap-x-5">
          <h1 className="text-[11pt]">Want to do more?</h1>
          <p className="flex-1">
            <b>3 friends</b> committed to this action but haven't started yet
          </p>
        </div>
        <Button
          color={ButtonColor.Stone}
          label="Send a poke"
          onClick={() => {}}
        />
      </div>
    </Card>
  );
};

export default PokePanel;
