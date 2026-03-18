import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";

const ActionPageTaskPanelCardWrapper = ({
  taskPanelTop = null,
  taskPanelTopStyle = CardStyle.LightGreyBorder,
  taskPanel,
  taskPanelStyle = CardStyle.WhiteBorder,
}: {
  taskPanelTop?: React.ReactNode;
  taskPanelTopStyle?: CardStyle;
  taskPanel: React.ReactNode;
  taskPanelStyle?: CardStyle;
}) => {
  return (
    <div>
      {taskPanelTop && (
        <Card style={taskPanelTopStyle} className="rounded-b-none">
          {taskPanelTop}
        </Card>
      )}
      <Card
        style={taskPanelStyle}
        className={cn(
          "p-4 sm:p-6",
          taskPanelTop
            ? "border-t-0 rounded-t-none"
            : "border-t",
        )}
      >
        {taskPanel}
      </Card>
    </div>
  );
};

export default ActionPageTaskPanelCardWrapper;
