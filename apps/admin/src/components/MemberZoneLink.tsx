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
      className="fixed bottom-0 left-0 p-2 text-zinc-400 hover:text-black"
    >
      <House size={16} />
    </a>
  );
};

export default MemberZoneLink;
