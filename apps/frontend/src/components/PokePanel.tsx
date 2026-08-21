import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";

const PokePanel = () => {
  return (
    <Card style={CardStyle.Grey} className="text-[11pt]">
      <div className="flex flex-row gap-8 justify-between">
        <div className="flex flex-col gap-x-5">
          <h2 className="text-[11pt]">Want to do more?</h2>
          <p className="flex-1">
            <b>3 friends</b> committed to this action but haven&apos;t started
            yet
          </p>
        </div>
        <Button color={ButtonColor.Stone} onClick={() => {}}>
          Send a poke
        </Button>
      </div>
    </Card>
  );
};

export default PokePanel;
