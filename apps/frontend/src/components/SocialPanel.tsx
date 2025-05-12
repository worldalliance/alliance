import Button, { ButtonColor } from "./system/Button";
import UserBubble from "./UserBubble";

const SocialPanel = () => {
  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex flex-row gap-x-2">
        <UserBubble />
        <div className="flex flex-col flex-1 justify-center">
          <p>
            <span className="font-bold">Friend Ipsum </span>
            <span className="text-gray-500">joined some action!</span>
          </p>
        </div>
        <Button
          label="Say thanks"
          onClick={() => {}}
          color={ButtonColor.Grey}
          className="text-[9pt]"
        />
      </div>
      <div className="flex flex-row gap-x-2">
        <UserBubble />
        <div className="flex flex-row flex-1 justify-center">
          <p>
            <span className="font-bold">Friend Lorem </span>
            <span className="text-gray-500">did some other thing!</span>
          </p>
        </div>
        <Button
          label="Say thanks"
          onClick={() => {}}
          color={ButtonColor.Grey}
          className="text-[9pt]"
        />
      </div>
    </div>
  );
};

export default SocialPanel;
