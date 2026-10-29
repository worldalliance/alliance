export interface ProgressBarProps {
  progress: number;
  total: number;
  /** A CSS `transition` for the fill's width; off under reduced motion. */
  fillTransition?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  total,
  fillTransition,
}: ProgressBarProps) => {
  const percentage = (progress / total) * 100;
  return (
    <div className="flex flex-col gap-x-2 flex-1 relative">
      <div className="w-full h-3 bg-zinc-100 rounded-[3px]">
        <div
          className="h-3 bg-green rounded-[3px] motion-reduce:transition-none!"
          style={{
            width: `${percentage}%`,
            transition: fillTransition,
          }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
