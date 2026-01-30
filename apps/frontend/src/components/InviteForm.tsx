import {
  CommunityDto,
  CreateOnetimeInviteDto,
  userCreateOnetimeInvite,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import CommunityCreateForm from "./CommunityCreateForm";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import {
  groupLeaderOnetimeInviteExplanation,
  groupLeaderOnetimeInviteTitle,
  onetimeInviteCreationExplanation,
  onetimeInviteCreationResponsibilityChoiceNo,
  onetimeInviteCreationResponsibilityChoiceYes,
  onetimeInviteCreationTitle,
  unaffiliatedOnetimeInviteExplanation,
  unaffiliatedOnetimeInviteTitle,
} from "@alliance/shared/lib/copy";
import { ArrowLeft } from "lucide-react";

type ResponsibilityChoice = "responsible" | "not_responsible" | null;

type InviteFormProps = {
  communities: CommunityDto[];
  onInviteCreated: () => void;
  onCommunitiesRefresh: () => void;
};

const InviteForm = ({
  communities,
  onInviteCreated,
  onCommunitiesRefresh,
}: InviteFormProps) => {
  const { user } = useAuth();
  const { error: errorToast, success: successToast } = useToast();
  const [responsibilityChoice, setResponsibilityChoice] =
    useState<ResponsibilityChoice>(null);
  const [inviteeName, setInviteeName] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState<
    number | "new" | null
  >(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const leaderCommunities = useMemo(() => {
    if (!user) {
      return [];
    }
    return communities.filter((community) =>
      community.leaders.some((leader) => leader.id === user.id)
    );
  }, [communities, user]);

  const isLeader = leaderCommunities.length > 0;

  const communityOptions = useMemo(() => {
    const options: Record<string, string | number> = {};
    leaderCommunities.forEach((community) => {
      options[`community_${community.id}`] = community.name;
    });
    options["new"] = "Create a new group";
    return options;
  }, [leaderCommunities]);

  // Auto-select first group when user chooses "responsible" and is a leader
  useEffect(() => {
    if (responsibilityChoice === "responsible" && !selectedCommunityId) {
      if (isLeader && leaderCommunities.length > 0) {
        // Select the first group
        setSelectedCommunityId(leaderCommunities[0].id);
      } else if (!isLeader) {
        // If not a leader, the create group form will be shown automatically
        // by the conditional rendering logic below
      }
    }
  }, [responsibilityChoice, selectedCommunityId, isLeader, leaderCommunities]);

  const handleCreateInvite = async () => {
    if (!inviteeName.trim()) {
      errorToast("Please enter the invitee's name");
      return;
    }

    if (responsibilityChoice === "responsible") {
      if (!selectedCommunityId) {
        errorToast("Please select a group");
        return;
      }
      if (selectedCommunityId === "new") {
        errorToast("Please create a group first");
        return;
      }
    }

    setCreatingInvite(true);
    try {
      const body: CreateOnetimeInviteDto = {
        invitee: inviteeName.trim(),
        ...(responsibilityChoice === "responsible" &&
          selectedCommunityId !== "new" &&
          selectedCommunityId !== null && {
            communityId: selectedCommunityId,
          }),
      };

      const response = await userCreateOnetimeInvite({ body });
      if (response.data) {
        successToast("Invite created successfully!");
        setInviteeName("");
        setSelectedCommunityId(null);
        setResponsibilityChoice(null);
        onInviteCreated();
      } else {
        errorToast(
          `Failed to create invite: ${
            response.response?.statusText || "Unknown error"
          }`
        );
      }
    } catch {
      errorToast("Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCreateCommunity = async (community: CommunityDto) => {
    try {
      // Refresh communities list in parent
      onCommunitiesRefresh();
      // Set the newly created community as selected
      setSelectedCommunityId(community.id);
      successToast("Group created successfully!");
    } catch {
      errorToast("Failed to refresh groups");
    }
  };

  // Step 1: Responsibility choice
  if (responsibilityChoice === null) {
    return (
      <Card style={CardStyle.Grey}>
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-xl">
              {onetimeInviteCreationTitle}
            </p>
            <div className="flex flex-col gap-y-2">
              {onetimeInviteCreationExplanation.map((block, index) => (
                <p className="text-zinc-500" key={index}>
                  {block}
                </p>
              ))}
            </div>
          </div>
          <div className="flex flex-row gap-2">
            <Button
              color={ButtonColor.Green}
              onClick={() => setResponsibilityChoice("responsible")}
              className="w-full"
            >
              {onetimeInviteCreationResponsibilityChoiceYes}
            </Button>
            <Button
              color={ButtonColor.Grey}
              onClick={() => setResponsibilityChoice("not_responsible")}
              className="w-full"
            >
              {onetimeInviteCreationResponsibilityChoiceNo}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Step 2: Not responsible - simple form
  if (responsibilityChoice === "not_responsible") {
    return (
      <Card style={CardStyle.Grey}>
        <div className="flex flex-col gap-y-4">
          <Button
            color={ButtonColor.Grey}
            className="flex flex-row gap-x-1"
            onClick={() => {
              setResponsibilityChoice(null);
              setInviteeName("");
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-xl">
              {unaffiliatedOnetimeInviteTitle}
            </p>
            {unaffiliatedOnetimeInviteExplanation.map((block, index) => (
              <p className="text-zinc-500" key={index}>
                {block}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-y-2">
            <div className="flex flex-row gap-x-2">
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 flex-1"
                placeholder="Enter the invitee's first name"
                value={inviteeName}
                onChange={(e) => setInviteeName(e.target.value)}
              />
              <Button
                color={ButtonColor.Black}
                onClick={handleCreateInvite}
                disabled={creatingInvite || !inviteeName.trim()}
              >
                {creatingInvite ? "Creating..." : "Create invite"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Step 3: Responsible - check if leader
  if (responsibilityChoice === "responsible") {
    // If not a leader and haven't selected a community yet, show create group form
    if (!isLeader && !selectedCommunityId) {
      return (
        <Card style={CardStyle.Grey}>
          <div className="flex flex-col gap-y-4">
            <p className="font-semibold">
              First, you need to create a group. This will allow you to easily
              view your new member&apos;s progress.
            </p>
            <CommunityCreateForm
              name={user?.name}
              onCancel={() => {
                setResponsibilityChoice(null);
              }}
              onSuccess={handleCreateCommunity}
            />
          </div>
        </Card>
      );
    }

    // If creating a new group (when already a leader choosing "new")
    if (selectedCommunityId === "new") {
      return (
        <Card style={CardStyle.Grey}>
          <div className="flex flex-col gap-y-4">
            <p className="text-xl font-semibold">Create a new group</p>
            <CommunityCreateForm
              name={user?.name}
              onCancel={() => {
                setSelectedCommunityId(null);
              }}
              onSuccess={handleCreateCommunity}
            />
          </div>
        </Card>
      );
    }

    // If leader (or just created a group), show dropdown and form
    // Note: If user just created a group, selectedCommunityId will be set
    // and we'll show the form even if isLeader hasn't updated yet
    const selectedCommunity =
      selectedCommunityId && typeof selectedCommunityId === "number"
        ? leaderCommunities.find((c) => c.id === selectedCommunityId) ||
          communities.find((c) => c.id === selectedCommunityId)
        : null;

    return (
      <Card style={CardStyle.Grey}>
        <div className="flex flex-col gap-y-4">
          <Button
            color={ButtonColor.Grey}
            className="flex flex-row gap-x-1"
            onClick={() => {
              setResponsibilityChoice(null);
              setInviteeName("");
              setSelectedCommunityId(null);
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col gap-y-2">
            <p className="text-xl font-semibold">
              {groupLeaderOnetimeInviteTitle}
            </p>
            {groupLeaderOnetimeInviteExplanation.map((block, index) => (
              <p className="text-zinc-500" key={index}>
                {block}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-y-2">
            {isLeader && leaderCommunities.length > 0 && (
              <div>
                <DropdownSelect
                  options={communityOptions}
                  value={
                    selectedCommunityId &&
                    typeof selectedCommunityId === "number"
                      ? communityOptions[`community_${selectedCommunityId}`] ||
                        selectedCommunity?.name ||
                        "Select a group"
                      : "Select a group"
                  }
                  onChange={([key]) => {
                    if (key === "new") {
                      setSelectedCommunityId("new");
                    } else {
                      const communityId = parseInt(
                        key.replace("community_", "")
                      );
                      setSelectedCommunityId(communityId);
                    }
                  }}
                  titleOverride={
                    selectedCommunityId &&
                    typeof selectedCommunityId === "number"
                      ? selectedCommunity?.name || "Select a group"
                      : "Select a group"
                  }
                />
              </div>
            )}
            <div className="flex flex-row gap-x-2">
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 flex-1"
                placeholder="Enter the invitee's first name"
                value={inviteeName}
                onChange={(e) => setInviteeName(e.target.value)}
              />
              <Button
                color={ButtonColor.Black}
                onClick={handleCreateInvite}
                disabled={
                  creatingInvite ||
                  !inviteeName.trim() ||
                  typeof selectedCommunityId !== "number"
                }
              >
                {creatingInvite ? "Creating invite..." : "Create invite"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return null;
};

export default InviteForm;
