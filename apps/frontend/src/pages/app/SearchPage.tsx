import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import SearchBar from "../../components/SearchBar";

const SearchPage = () => {
  useWhiteBackground();

  return (
    <CenterLayout>
      <div className="flex flex-col gap-y-4">
        <p className="text-title">Search</p>
        <div className="flex w-full">
          <SearchBar autofocus />
        </div>
      </div>
    </CenterLayout>
  );
};

export default SearchPage;
