import {
  INFO_CONTACTS,
  InfoEntryId,
  visibleInfoResources,
} from "@alliance/shared/lib/informationPage";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import {
  BookOpenText,
  BookUser,
  CalendarCheck,
  ClipboardList,
  Handshake,
  Info,
  ListOrdered,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  Megaphone,
  PenTool,
  Scale,
  Users,
} from "lucide-react";
import React from "react";
import { href } from "react-router";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import InfoResourceCard, {
  type InfoResourceCardProps,
} from "../../components/InfoResourceCard";
import { isFeatureEnabled } from "../../lib/config";

const ICONS: Record<InfoEntryId, LucideIcon> = {
  [InfoEntryId.Email]: Mail,
  [InfoEntryId.Visit]: CalendarCheck,
  [InfoEntryId.WhatIsTheAlliance]: Info,
  [InfoEntryId.MemberDirectory]: BookUser,
  [InfoEntryId.Roadmap]: MapIcon,
  [InfoEntryId.AboutGroups]: Users,
  [InfoEntryId.AboutAmbassadors]: Handshake,
  [InfoEntryId.HowToDesignActions]: PenTool,
  [InfoEntryId.ActionUpdates]: ClipboardList,
  [InfoEntryId.GeneralUpdates]: Megaphone,
  [InfoEntryId.Priorities]: ListOrdered,
  [InfoEntryId.Governance]: Scale,
  [InfoEntryId.Terminology]: BookOpenText,
};

const InformationPage: React.FC = () => {
  useWhiteBackground();

  const contacts: InfoResourceCardProps[] = INFO_CONTACTS.map(
    ({ id, title, description, href }) => ({
      title,
      description,
      href,
      icon: ICONS[id],
    }),
  );

  const resources: InfoResourceCardProps[] = visibleInfoResources(
    isFeatureEnabled,
  ).map(({ id, title, description, path }) => ({
    title,
    description,
    href: href(path),
    icon: ICONS[id],
  }));

  return (
    <CenterLayout>
      <div className="gap-y-8 md:gap-y-12 flex flex-col text-base md:text-lg">
        <div className="flex flex-col gap-y-6">
          <h2 className="text-title-small">Contact</h2>

          <div className="grid grid-cols-1 gap-2 grid-flow-row">
            {contacts.map((contact) => (
              <InfoResourceCard key={contact.href} {...contact} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          <h2 className="text-title-small">Resources</h2>

          <div className="grid grid-cols-1 gap-2 grid-flow-row">
            {resources.map((resource) => (
              <InfoResourceCard key={resource.href} {...resource} />
            ))}
          </div>
        </div>
      </div>
    </CenterLayout>
  );
};

export default InformationPage;
