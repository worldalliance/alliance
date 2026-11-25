import ImageUpload from "../pages/ImageUpload";
import VideoManagement from "../pages/VideoManagement";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";

export default function MediaPlace() {
  return (
    <TabbedPlace
      place={PlaceId.Media}
      tabs={{ images: ImageUpload, videos: VideoManagement }}
    />
  );
}
