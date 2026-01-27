import { useGroupAssignment } from "../lib/GroupReassignmentContext";

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
