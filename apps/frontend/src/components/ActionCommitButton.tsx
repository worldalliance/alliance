import Button from "./system/Button";

export interface ActionCommitButtonProps {
  committed: boolean;
  isAuthenticated: boolean;
  onCommit: () => void;
}

const ActionCommitButton = ({
  committed,
  isAuthenticated,
  onCommit,
}: ActionCommitButtonProps) => {
  return (
    <Button onClick={onCommit} disabled={!isAuthenticated}>
      {committed ? "Joined" : "Commit"}
    </Button>
  );
};

export default ActionCommitButton;
