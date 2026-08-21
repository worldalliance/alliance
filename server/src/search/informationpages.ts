import { SearchItem, SearchItemType } from "./searchitem.dto";

export const infoPageSearchItems: SearchItem[] = [
  {
    id: "faq",
    name: "Frequently asked questions",
    type: SearchItemType.Page,
    webAppLocation: "/faq",
  },
  {
    id: "guide",
    name: "Guide to the Alliance",
    type: SearchItemType.Page,
    webAppLocation: "/guide",
  },
  {
    id: "foundation",
    name: "Foundation",
    type: SearchItemType.Page,
    webAppLocation: "/foundation",
  },
  {
    id: "governance",
    name: "Governance",
    type: SearchItemType.Page,
    webAppLocation: "/governance",
  },
  {
    id: "members",
    name: "Member directory",
    type: SearchItemType.Page,
    webAppLocation: "/members",
  },
  {
    id: "groups-guide",
    name: "Groups guide",
    type: SearchItemType.Page,
    webAppLocation: "/groups-guide",
  },
];
