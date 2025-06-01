import { ActionDto } from "@alliance/shared/client";
import Timeline from "./system/Timeline";
import TimelineItem from "./system/TimelineItem";

const ActionEventsPanel = ({ action }: { action: ActionDto }) => {
  return (
    <div className="flex flex-col gap-y-3">
      <h2>Activity</h2>
      <Timeline>
        <TimelineItem
          title="Action Created"
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
          time="5:37 AM"
        />
        <TimelineItem
          title="Action Created"
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
          time="5:37 AM"
        />
      </Timeline>
    </div>
  );
};

export default ActionEventsPanel;
