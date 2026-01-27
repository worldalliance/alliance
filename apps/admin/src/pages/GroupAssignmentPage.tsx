import { useGroupAssignment } from "../lib/GroupAssignmentContext";

const GroupAssignmentPage: React.FC = () => {
  const { membersUndergoingGroupAssignment } = useGroupAssignment();

  return (
    <div>
      {membersUndergoingGroupAssignment.map((member) => (
        <div key={member.id}>{JSON.stringify(member)}</div>
      ))}
    </div>
  );
};

export default GroupAssignmentPage;
