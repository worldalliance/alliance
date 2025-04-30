import React from "react";
import Card from "./system/Card";
import { CommuniqueDto } from "../client";
import { useNavigate } from "react-router-dom";

interface AnnouncementCardProps {
  unread: boolean;
  data: CommuniqueDto;
  className?: string;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  data,
  className,
}) => {
  const truncatedBody = data.bodyText.slice(0, 100);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/announcements/${data.id}`);
  };

  return (
    <div className={`relative ${className} `}>
      <Card
        className="block bg-stone-50 text-[11pt] font-avenir"
        onClick={handleClick}
      >
        <div className="flex items-center justify-start w-[100%] space-x-3">
          <p className="font-bold">{data.title}</p>
        </div>
        <div className="flex items-center justify-between ">
          <p>{truncatedBody}</p>
        </div>
      </Card>
    </div>
  );
};

export default AnnouncementCard;
