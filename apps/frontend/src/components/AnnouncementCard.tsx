import React from "react";
import Card from "./system/Card";
import { CommuniqueDto } from "@alliance/shared/client";
import { useNavigate } from "react-router";
import test_image from "../stories/test_image.jpg";
import { getImageSource } from "../lib/config";
import StatusIndicator, { Status } from "./StatusIndicator";

export interface AnnouncementCardProps {
  unread: boolean;
  data: CommuniqueDto;
  className?: string;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  data,
  className,
  unread,
}) => {
  // Truncate the body text to a reasonable length based on card type
  const truncatedBody =
    data.bodyText.slice(0, unread ? 400 : 100) +
    (data.bodyText.length > (unread ? 400 : 100) ? "..." : "");
  const navigate = useNavigate();

  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const handleClick = () => {
    navigate(`/announcements/${data.id}`);
  };

  console.log("card with id: ", data.id, "is unread: ", unread);

  let imgSource = null;
  if (data.headerImage) {
    imgSource = getImageSource(data.headerImage);
  } else if (import.meta.env.STORYBOOK) {
    imgSource = test_image;
  }

  const unreadStyles = "h-[185px] ";
  const readStyles = "h-[100px]";

  return (
    <div className="relative w-full">
      {unread && <StatusIndicator status={Status.Unread} />}
      <Card
        className={`block bg-pagebg text-[11pt] font-avenir overflow-hidden !p-0 ${className} ${
          unread ? unreadStyles : readStyles
        }`}
        onClick={handleClick}
      >
        <div className="flex flex-row h-full">
          <div className="flex flex-col p-5 gap-y-2 w-full relative">
            <div className="flex flex-row justify-between items-center w-full">
              <h2 className="font-bold">{data.title}</h2>
              <p className="text-gray-500 text-[10pt]">
                {formatDate(data.dateCreated)}
              </p>
            </div>
            <p className="relative">{truncatedBody}</p>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent"></div>
          </div>
          {unread && imgSource && (
            <img
              src={imgSource}
              className="h-full aspect-square object-cover"
              alt="header"
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default AnnouncementCard;
