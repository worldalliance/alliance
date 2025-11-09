interface TimelineItemProps {
  title?: string;
  description: string;
  time?: string;
  first?: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  title,
  description,
  time,
  first = false,
}: TimelineItemProps) => {
  return (
    <span>
      <div className="flex flex-col gap-x-2">
        <p className={`${first ? "font-medium text-green" : "text-zinc-500"}`}>
          {title}
        </p>
        <p className="text-zinc-500 text-sm">{time}</p>
      </div>
      <p className="mt-1 text-zinc-500 text-sm">{description}</p>
    </span>
  );
};

export default TimelineItem;
