interface TimelineItemProps {
  title?: string;
  description: string;
  time?: string;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  title,
  description,
  time,
}: TimelineItemProps) => {
  return (
    <span>
      <div className="flex flex-row gap-x-2 items-center">
        <p className="font-bold text-gray-500">{time}</p>
        <p className="font-bold text-lg mb-[1.5px]">{title}</p>
      </div>
      <p>{description}</p>
    </span>
  );
};

export default TimelineItem;
