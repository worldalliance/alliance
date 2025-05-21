import { ActionDto } from "@alliance/shared/client";
import ActionItemCard from "./ActionItemCard";
import { ButtonColor } from "./system/Button";
import Button from "./system/Button";
import { useNavigate } from "react-router-dom";
export interface HomeNewActionsViewProps {
  actions: ActionDto[];
}

export const HomeNewActionsView: React.FC<HomeNewActionsViewProps> = ({
  actions: initialActions,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row items-center gap-x-2 justify-between w-full mt-5">
        <h1 className="text-[#111] !text-[16pt] font-font">New Actions</h1>
        <Button color={ButtonColor.Light} onClick={() => navigate("/actions")}>
          See all actions
        </Button>
      </div>
      {initialActions.map((action) => (
        <ActionItemCard key={action.id} {...action} />
      ))}
      {initialActions.length === 0 && (
        <p className="text-center text-gray-500 py-5">
          No new actions to show right now!
        </p>
      )}
    </div>
  );
};

export default HomeNewActionsView;
