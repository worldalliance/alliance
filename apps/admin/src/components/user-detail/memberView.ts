import type { TabItem } from "../ui/Tabs";

export enum MemberView {
  Profile = "profile",
  Activity = "activity",
  Messages = "messages",
  Connections = "connections",
}

export const MEMBER_VIEWS = Object.values(MemberView);

const VIEW_LABEL: Record<MemberView, string> = {
  [MemberView.Profile]: "Profile",
  [MemberView.Activity]: "Activity",
  [MemberView.Messages]: "Messages",
  [MemberView.Connections]: "Connections",
};

export const MEMBER_VIEW_ITEMS: TabItem<MemberView>[] = MEMBER_VIEWS.map(
  (view) => ({ key: view, label: VIEW_LABEL[view] }),
);
