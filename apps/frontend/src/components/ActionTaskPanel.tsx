import { ActionDto, UserActionDto } from "@alliance/shared/client";
import ActionTaskPanelFunding from "./ActionTaskPanelFunding";
import { StripeWrapper } from "./StripeWrapper";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";
import { isRouteErrorResponse, useOutletContext } from "react-router";
import Card, { CardStyle } from "./system/Card";
import { loader as actionLoader } from "../pages/app/ActionPage";
import { Route } from "../../.react-router/types/src/components/+types/ActionTaskPanel";
import ActionCommitButton from "./ActionCommitButton";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error(error);
  let errorText: string | undefined = undefined;
  if (isRouteErrorResponse(error)) {
    errorText = error.statusText;
  } else if (error instanceof Error) {
    errorText = error.name;
  }
  return (
    <Card>
      <p className="text-red-500 text-center">
        Error loading task: {errorText}
      </p>
    </Card>
  );
}

export type ParentContext = {
  handleCompleteAction: () => void;
  handleJoinAction: () => void;
  action?: ActionDto;
  userRelation: UserActionDto["status"] | null;
};

const ActionTaskPanel = ({ matches }: { matches: { data: unknown }[] }) => {
  const { handleCompleteAction, handleJoinAction, userRelation } =
    useOutletContext<ParentContext>();

  const action = matches[3]!.data as Awaited<ReturnType<typeof actionLoader>>; //TODO: rrv7 type safety best practices?

  if (!action) {
    return null;
  }

  console.log("userRelation:", userRelation);

  if (userRelation === "completed") {
    return <ActionTaskPanelCompleted />;
  }

  if (action.status === "gathering_commitments") {
    if (userRelation === "joined") {
      return (
        <Card style={CardStyle.Green}>
          <p>
            <b>Joined </b>- We&apos;ll notify you when it&apos;s time to act.
          </p>
        </Card>
      );
    } else {
      return (
        <Card
          style={CardStyle.White}
          className="flex-row items-center gap-x-2 justify-between"
        >
          <span>Ready to join?</span>
          <ActionCommitButton
            committed={false}
            isAuthenticated={true}
            onCommit={handleJoinAction}
          />
        </Card>
      );
    }
  }

  if (action.status === "member_action") {
    if (action.type === "Funding") {
      return (
        <StripeWrapper actionId={action.id}>
          <ActionTaskPanelFunding onPaymentSuccess={handleCompleteAction} />
        </StripeWrapper>
      );
    }
  }
  return null;
};

export default ActionTaskPanel;
