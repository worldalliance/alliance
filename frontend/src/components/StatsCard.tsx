import { ProgressCircle } from "./ProgressCircle";
import Card, { CardStyle } from "./system/Card";

const StatsCard = () => {
  return (
    <Card style={CardStyle.White}>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center gap-x-5">
          <ProgressCircle value={62} strokeWidth={10} variant="success" />
          <p>
            <b>72%</b> of active alliance members committed
          </p>
        </div>
        <div className="flex flex-row items-center gap-x-3">
          <ProgressCircle value={34} strokeWidth={10} variant="neutral" />
          <p>34% boycott progress</p>
        </div>
        <div className="flex flex-row items-center gap-x-3">
          <ProgressCircle value={12} strokeWidth={10} variant="warning" />
          <p>
            <b>12</b> days left
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
