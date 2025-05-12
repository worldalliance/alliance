import { ProgressCircle } from "./tremor/ProgressCircle";

export enum Status {
  New = "New",
  InProgress = "InProgress",
  Unread = "Unread",
}

export interface StatusIndicatorProps {
  status: Status;
}

const StatusIndicator = ({ status }: StatusIndicatorProps) => {
  return status === Status.New ? (
    <div className="absolute top-0 my-auto bottom-0 left-[-30px] h-fit rounded-full text-red-500 text-[25pt] font-bold">
      !
    </div>
  ) : status === Status.Unread ? (
    <div className="absolute top-0 my-auto bottom-0 left-[-35px] rounded-full bg-blue-500 w-4 h-4"></div>
  ) : (
    <div className="absolute top-0 my-auto bottom-0 left-[-35px] h-fit rounded-full">
      <ProgressCircle
        value={Math.floor(Math.random() * 100)}
        width={20}
        strokeWidth={15}
      />
    </div>
  );
};

export default StatusIndicator;
