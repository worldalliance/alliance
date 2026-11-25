import { useSearchParams } from "react-router";
import ActionSuitePage from "../pages/ActionSuitePage";
import SuiteLaunchPage from "../pages/SuiteLaunchPage";
import { TabParam } from "../places";

/** Launch is the suite's `?tab=launch`; its other tabs are still one page. */
export default function SuiteRecord() {
  const [searchParams] = useSearchParams();
  return searchParams.get(TabParam.Tab) === "launch" ? (
    <SuiteLaunchPage />
  ) : (
    <ActionSuitePage />
  );
}
