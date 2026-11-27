import { memberPathFor } from "@alliance/sharedweb/lib/zoneLinks";
import { House } from "lucide-react";
import { useLocation } from "react-router";
import { getSiteUrl } from "../lib/config";

const MemberZoneLink = () => {
  const { pathname } = useLocation();
  return (
    <a
      href={`${getSiteUrl()}${memberPathFor(pathname)}`}
      aria-label="Open in member zone"
      title="Open in member zone"
      className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
    >
      <House size={16} aria-hidden />
    </a>
  );
};

export default MemberZoneLink;
