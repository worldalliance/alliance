import Card, { CardStyle } from "@alliance/shared/ui/Card";

interface MemberContractProps {
  id?: string;
  className?: string;
}

const MemberContract = ({ id, className }: MemberContractProps) => {
  return (
    <Card className={className} style={CardStyle.White} id={id}>
      <div className="text-zinc-900 px-3 p-1 md:p-3">
        <ol className="list-decimal list-inside flex flex-col gap-y-2">
          <li>
            I commit to complete up to 15 minutes of Alliance tasks per week.
          </li>
          <li>
            I commit to complete every task I am assigned by its deadline,
            unless:
          </li>
          <ol className="list-inside list-[lower-alpha] ml-6">
            <li>
              I have spent more than 15 minutes completing Alliance tasks in the
              past week.
            </li>
            <li>
              I cannot complete the task due to a serious external circumstance,
              such as a medical issue or family emergency. In this case, I will
              inform the strategic office as soon as I can.
            </li>
            <li>
              I believe the task is immoral. In this case, I will inform the
              strategic office of my reasoning by the deadline for the task.
            </li>
          </ol>
          <li>
            I understand that I am considered an active member, and am therefore
            able to participate in Alliance governance, if I have completed at
            least 8 of the last 10 tasks I was assigned.
          </li>
        </ol>
      </div>
    </Card>
  );
};

export default MemberContract;
