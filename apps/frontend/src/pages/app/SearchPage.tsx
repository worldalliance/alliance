import SearchBar from "../../components/SearchBar";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";

const SearchPage = () => {
  useWhiteBackground();

  return (
    <div className="flex flex-col max-w-3xl mx-auto p-3 pt-6 md:pt-24">
      <p className="font-serif text-3xl md:text-4xl font-medium mb-4">Search</p>
      <div className="flex w-full">
        <SearchBar />
      </div>
    </div>
  );
};

export default SearchPage;
