import Card from "./system/Card";
import UserBubble from "./UserBubble";
const SocialPanel = () => {
  return (
    <Card className="w-[300px] h-[300px] font-avenir text-[11pt] gap-y-5">
      <div className="flex flex-row gap-x-2">
        <UserBubble />
        <div className="flex flex-col flex-1 justify-center">
          <p>
            <span className="font-bold">Friend Ipsum </span>
            <span className="text-gray-500">
              joined some action 10 minutes ago!
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-row gap-x-2">
        <UserBubble />
        <div className="flex flex-col flex-1 justify-center">
          <p>
            <span className="font-bold">Friend Lorem </span>
            <span className="text-gray-500">did some other thing!</span>
          </p>
        </div>
      </div>
    </Card>
  );
};

export default SocialPanel;
