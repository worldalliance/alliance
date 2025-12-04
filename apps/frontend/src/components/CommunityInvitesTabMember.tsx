import {
  CommunityInviteDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  ProfileDto,
  userCreateCommunityInvite,
  userCreateOnetimeInvite,
  userDeleteCommunityInvite,
  userDeleteOnetimeInvite,
  userGetCommunityInvites,
  userGetOnetimeInvitesByCommunity,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import List from "@alliance/shared/ui/List";
import { getBaseUrl } from "@alliance/shared/lib/config";
import UserSelect, {
  UserSelectUser,
  useSelectableUserIds,
} from "@alliance/shared/ui/UserSelect";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import OneTimeInviteListItem from "./OneTimeInviteListItem";
import CommunityInviteListItem from "./CommunityInviteListItem";

export interface CommunityInvitesTabProps {
  communityId: number;
  existingMembers: ProfileDto[];
}

export enum InviteMode {
  NewMember = "New Alliance member",
  CurrentMember = "Current Alliance member",
}

const CommunityInvitesTabMember = ({
  communityId,
  existingMembers,
}: CommunityInvitesTabProps) => {
  return <></>;
};

export default CommunityInvitesTabMember;
