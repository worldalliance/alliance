import { useNavigate, useParams } from "react-router";
import SuiteLaunchPanel from "../components/suite-launch/SuiteLaunchPanel";
import {
  suiteLoadError,
  useActionSuiteAdmin,
} from "../lib/useActionSuiteAdmin";

const SuiteLaunchPage = () => {
  const { suiteId: suiteIdString } = useParams();
  const suiteId = Number(suiteIdString);
  const { suite: suiteQuery, addEvent } = useActionSuiteAdmin(suiteId);
  const navigate = useNavigate();

  const suite = suiteQuery.data;
  if (!suite) {
    return suiteQuery.isError ? (
      <p className="p-6 text-red-500">{suiteLoadError(suiteQuery.error)}</p>
    ) : (
      <div className="p-6">Loading...</div>
    );
  }
  return (
    <div className="p-6">
      <SuiteLaunchPanel
        suite={suite}
        addEvent={addEvent.mutateAsync}
        onClose={() => navigate(`/suites/${suiteId}`)}
      />
    </div>
  );
};

export default SuiteLaunchPage;
