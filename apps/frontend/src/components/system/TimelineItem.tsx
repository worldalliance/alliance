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
      <div className="flex flex-col gap-x-2">
        <p className="text-gray-500 text-sm">{time}</p>
        <p className="font-bold">{title}</p>
      </div>
      <p className="mt-1">{description}</p>
    </span>
  );
};

export default TimelineItem;
