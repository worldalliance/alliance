export interface TwoColumnSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  coloredLeft?: boolean;
  coloredRight?: boolean;
  collapseRight?: boolean;
  bg?: string;
  border?: boolean;
}

const TwoColumnSplit = ({
  left,
  right,
  coloredRight = false,
  collapseRight = false,
}: TwoColumnSplitProps) => {
  return (
    <div
      className={`flex flex-row w-full max-w-[1250px] mx-auto justify-between bg-white ${
        coloredRight ? "bg-green" : ""
      }`}
    >
      <div
        className={`flex flex-col gap-y-5 overflow-y-auto !overflow-visible flex-1 items-center p-10`}
      >
        {left}
      </div>
      <div
        className={`border-l border-zinc-200 md:flex flex-col gap-y-5 overflow-y-auto items-stretch w-[360px] p-10 ${
          collapseRight ? "hidden md:flex" : ""
        }`}
      >
        {right}
      </div>
    </div>
  );
};

export default TwoColumnSplit;
