import UserBubble from "./UserBubble";

const UserBubbleRow: React.FC = () => {
  return (
    <div className="flex flex-row gap-x-2">
      <UserBubble clipped={true} />
      <UserBubble clipped={true} />
      <UserBubble clipped={true} />
      <UserBubble clipped={true} />
      <UserBubble clipped={true} />
      <UserBubble />
    </div>
  );
};

export default UserBubbleRow;
