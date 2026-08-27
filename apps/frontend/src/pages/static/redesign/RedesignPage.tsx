import { useSearchParams } from "react-router";
import "./redesign.css";
import { RedesignHome } from "./RedesignHome";
import { parseVersion, redesignThemes, type RedesignVersion } from "./theme";
import { VersionConsole } from "./VersionConsole";

export function meta() {
  return [
    { title: "The Alliance — homepage mockups" },
    { name: "robots", content: "noindex" },
  ];
}

export default function RedesignPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const version = parseVersion(searchParams.get("v"));

  const select = (next: RedesignVersion) => {
    setSearchParams({ v: next }, { preventScrollReset: true });
  };

  return (
    <>
      <RedesignHome key={version} theme={redesignThemes[version]} />
      <VersionConsole active={version} onSelect={select} />
    </>
  );
}
