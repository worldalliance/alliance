import { useNavigate, useParams } from "react-router";
import SuiteLaunchPanel from "../components/suite-launch/SuiteLaunchPanel";
import { refetchFresh } from "../lib/refetchFresh";
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
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      {suite ? (
        <SuiteLaunchPanel
          suite={suite}
          addEvent={addEvent.mutateAsync}
          fetchSuite={() => refetchFresh(suiteQuery.refetch)}
          onClose={() => navigate(`/suites/${suiteId}`)}
        />
      ) : suiteQuery.isError ? (
        <p className="text-red-500">{suiteLoadError(suiteQuery.error)}</p>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
};

export default SuiteLaunchPage;
