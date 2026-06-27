import { Features } from "@alliance/shared/lib/features";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import {
  BookOpenText,
  BookUser,
  CalendarCheck,
  ClipboardList,
  Handshake,
  Info,
  ListOrdered,
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

const InformationPage: React.FC = () => {
  useWhiteBackground();

  const contacts: InfoResourceCardProps[] = [
    {
      title: "Email",
      description: "Email the office with questions, feedback, or ideas.",
      href: "mailto:contact@worldalliance.org",
      icon: Mail,
    },
    {
      title: "Schedule a visit",
      description:
        "Schedule a visit to the Alliance's physical office in San Francisco, CA, USA.",
      href: "mailto:contact@worldalliance.org?subject=Request to visit the office&body=I would like to schedule a visit to the Alliance's physical office on [DATE] at [TIME].",
      icon: CalendarCheck,
    },
  ];

  const resources: InfoResourceCardProps[] = [
    {
      title: "What is the Alliance?",
      description:
        "The Alliance is a global group of individuals cooperating to improve the world.",
      href: href("/guide"),
      icon: Info,
    },
    {
      title: "Member directory",
      description: "A list of all members of the Alliance.",
      href: href("/members"),
      icon: BookUser,
    },
    {
      title: "Roadmap",
      description:
        "The Alliance is in an experimental phase and building up to a public launch.",
      href: href("/roadmap"),
      icon: MapIcon,
    },
    {
      title: "How groups work",
      description:
        "The Alliance is organized into groups that help members hold each other accountable.",
      href: href("/groups-guide"),
      icon: Users,
    },
    {
      title: "How to design actions",
      description: "A basic guide that the office uses to design actions.",
      href: href("/action-design"),
      icon: PenTool,
    },
    {
      title: "Ambassador Program",
      description:
        "How ambassadors help the Alliance recruit reliable new members.",
      href: href("/ambassador-program"),
      icon: Handshake,
    },
    {
      title: "Action updates",
      description: "Progress updates on our actions.",
      href: href("/action-updates"),
      icon: ClipboardList,
    },
    ...(isFeatureEnabled(Features.GeneralUpdatesLink)
      ? [
          {
            title: "General updates",
            description:
              "Updates about the Alliance's progress as an organization.",
            href: href("/general-updates"),
            icon: Megaphone,
          },
        ]
      : []),
    {
      title: "Priorities",
      description: "An overview of our current priorities.",
      href: href("/priorities"),
      icon: ListOrdered,
    },
    {
      title: "Governance",
      description: "Members participate in a regular oversight process.",
      href: href("/internal-governance"),
      icon: Scale,
    },
    {
      title: "Terminology",
      description: "Some terms used in the Alliance.",
      href: href("/terminology"),
      icon: BookOpenText,
    },
  ];

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
