import {
  UserDto,
  userGetGroupAssignmentMembers,
} from "@alliance/shared/client";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface GroupAssignmentContext {
  membersUndergoingGroupAssignment: UserDto[];
  assignMembers: (memberIds: number[]) => void;
}

const GroupAssignmentContext = createContext<
  GroupAssignmentContext | undefined
>(undefined);

export const GroupAssignmentProvider = memo(
  ({ children }: React.PropsWithChildren) => {
    const [
      membersUndergoingGroupAssignment,
      setMembersUndergoingGroupAssignment,
    ] = useState<UserDto[]>([]);

    useEffect(() => {
      userGetGroupAssignmentMembers().then((response) => {
        if (response.data) {
          setMembersUndergoingGroupAssignment(response.data);
        }
      });
    }, []);

    const assignMembers = useCallback((memberIds: number[]) => {
      const memberIdSet = new Set(memberIds);
      setMembersUndergoingGroupAssignment((prev) =>
        prev.filter((member) => !memberIdSet.has(member.id))
      );
    }, []);

    const value = useMemo<GroupAssignmentContext>(
      () => ({
        membersUndergoingGroupAssignment,
        assignMembers,
      }),
      [membersUndergoingGroupAssignment, assignMembers]
    );

    return (
      <GroupAssignmentContext.Provider value={value}>
        {children}
      </GroupAssignmentContext.Provider>
    );
  }
);

GroupAssignmentProvider.displayName = "GroupAssignmentProvider";

export const useGroupAssignment = () => {
  const ctx = useContext(GroupAssignmentContext);
  if (import.meta.env.STORYBOOK) {
    return {
      membersUndergoingGroupAssignment: [],
      assignMembers: () => undefined,
    } satisfies GroupAssignmentContext;
  }
  if (!ctx)
    throw new Error(
      "useGroupAssignment must be used within a GroupAssignmentProvider"
    );
  return ctx;
};
