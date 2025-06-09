export interface TwoColumnSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  coloredLeft?: boolean;
  coloredRight?: boolean;
  border?: boolean;
}

const TwoColumnSplit = ({
  left,
  right,
  coloredLeft = false,
  coloredRight = false,
  border = true,
}: TwoColumnSplitProps) => {
  return (
    <div
      className={`flex flex-row min-h-[calc(100vh-49px)] w-full h-full justify-center bg-pagebg ${
        coloredRight ? "bg-agreen" : "bg-white"
      }`}
    >
      <div
        className={`flex flex-col flex-2 ${
          border ? "sm:border-r border-stone-300" : ""
        } items-center ${coloredLeft ? "bg-agreen" : "bg-white"}`}
      >
        {left}
      </div>
      <div
        className={`flex-col items-stretch flex-1 max-w-[350px] h-full ${
          coloredRight ? "bg-agreen" : "bg-white"
        } min-h-[calc(100vh-49px)] hidden sm:flex`}
      >
        {right}
      </div>
    </div>
  );
};

export default TwoColumnSplit;
