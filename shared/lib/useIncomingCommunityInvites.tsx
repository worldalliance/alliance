import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import {
  CommunityInviteDto,
  userAcceptCommunityInvite,
  userGetIncomingCommunityInvitesForUser,
  userRejectCommunityInvite,
} from "@alliance/shared/client";

type IncomingCommunityInvitesContext = {
  incomingCommunityInvitesById: Map<number, CommunityInviteDto>;
  pendingCommunityInvites: CommunityInviteDto[];
  acceptCommunityInvite: (inviteId: number) => Promise<void>;
  declineCommunityInvite: (inviteId: number) => Promise<void>;
};

const IncomingCommunityInvitesContext =
  createContext<IncomingCommunityInvitesContext | null>(null);

export const IncomingCommunityInvitesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [invites, setInvites] = useState<CommunityInviteDto[]>([]);

  useEffect(() => {
    userGetIncomingCommunityInvitesForUser().then((response) => {
      if (response.data) {
        setInvites(response.data);
      }
    });
  }, []);

  const incomingCommunityInvitesById = useMemo(() => {
    return new Map<number, CommunityInviteDto>(
      invites.map((invite) => [invite.id, invite])
    );
  }, [invites]);

  const pendingCommunityInvites = useMemo(() => {
    return invites.filter((invite) => invite.status === "invitee_pending");
  }, [invites]);

  const acceptCommunityInvite = useCallback(
    async (inviteId: number) => {
      const response = await userAcceptCommunityInvite({ path: { inviteId } });
      if (response.data) {
        setInvites((prev) =>
          prev.map((invite) => ({
            ...invite,
            ...(invite.id === inviteId && { status: "invitee_accepted" }),
          }))
        );
      }
    },
    [setInvites]
  );

  const declineCommunityInvite = useCallback(
    async (inviteId: number) => {
      const response = await userRejectCommunityInvite({ path: { inviteId } });
      if (response.data) {
        setInvites((prev) =>
          prev.map((invite) => ({
            ...invite,
            ...(invite.id === inviteId && { status: "invitee_rejected" }),
          }))
        );
      }
    },
    [setInvites]
  );

  return (
    <IncomingCommunityInvitesContext.Provider
      value={{
        incomingCommunityInvitesById,
        pendingCommunityInvites,
        acceptCommunityInvite,
        declineCommunityInvite,
      }}
    >
      {children}
    </IncomingCommunityInvitesContext.Provider>
  );
};

const useIncomingCommunityInvites = (): IncomingCommunityInvitesContext => {
  const ctx = useContext(IncomingCommunityInvitesContext);
  if (!ctx) {
    throw new Error(
      "useCommunityInvites must be used within CommunityInvitesProvider"
    );
  }
  return ctx;
};

export default useIncomingCommunityInvites;
