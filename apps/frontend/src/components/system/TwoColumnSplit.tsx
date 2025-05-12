export interface TwoColumnSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  coloredRight?: boolean;
}

const TwoColumnSplit = ({
  left,
  right,
  coloredRight = false,
}: TwoColumnSplitProps) => {
  return (
    <div className="flex flex-row min-h-screen w-full h-full justify-center bg-pagebg">
      <div className="flex flex-col flex-2 border-r border-zinc-400 items-center">
        {left}
      </div>
      <div
        className={`flex-col items-stretch flex-1 max-w-[350px] h-full ${
          coloredRight ? "bg-[#c4d8bf]" : "bg-white"
        } min-h-[100vh] hidden sm:flex`}
      >
        {right}
      </div>
    </div>
  );
};

export default TwoColumnSplit;
