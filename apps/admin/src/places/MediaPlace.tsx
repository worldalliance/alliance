import type { ReactNode } from "react";
import { ImageUploadTab } from "../pages/media/ImageUploadTab";
import { VideosTab } from "../pages/media/VideosTab";
import { PlaceId } from "../places";
import { Page } from "../ui/templates/Page";
import { usePlaceTabs } from "../ui/templates/usePlaceTabs";

const TABS = ["images", "videos"] as const;
type Tab = (typeof TABS)[number];

const BODY: Record<Tab, () => ReactNode> = {
  images: () => <ImageUploadTab />,
  videos: () => <VideosTab />,
};

// Only the list fills the frame; the upload form scrolls with it.
const FILLS: Record<Tab, boolean> = { images: false, videos: true };

export default function MediaPlace() {
  const tabs = usePlaceTabs(PlaceId.Media, TABS);
  return (
    <Page
      fill={FILLS[tabs.value]}
      place={PlaceId.Media}
      description="Upload an image to get its link, and manage the videos uploaded to forms."
      tabs={tabs}
    >
      {BODY[tabs.value]()}
    </Page>
  );
}
