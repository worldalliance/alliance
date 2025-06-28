export interface ProgressBarProps {
  progress: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  total,
}: ProgressBarProps) => {
  const percentage = (progress / total) * 100;
  return (
    <div className="flex flex-col gap-x-2 flex-1 relative pr-32">
      <div className="w-full h-3 bg-gray-100 rounded-[3px]">
        <div
          className="h-3 bg-[#5d9c2d] rounded-[3px]"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
