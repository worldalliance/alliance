import { R } from "@alliance/common/result";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";

const NewActionSuitePage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { createSuite } = useActionSuitesAdmin();

  const handleCancel = () => {
    navigate("/actions");
  };

  const handleCreateSuite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const suiteName = formData.get("suiteName") as string;
    const created = await R.fromPromise(
      createSuite.mutateAsync(suiteName),
      (thrown) => adminRefusalMessage(thrown, "Failed to create suite"),
    );
    if (!created.ok) {
      setError(created.error);
      return;
    }
    navigate(`/suites/${created.value.id}`);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <Card className="p-6">
        <form onSubmit={handleCreateSuite} className="space-y-4">
          {error && <p className="text-red-500">{error}</p>}
          <p className="font-bold">Create a new action suite</p>
          <input
            type="text"
            name="suiteName"
            placeholder="Suite Name"
            autoFocus
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="flex flex-row justify-end min-w-96 gap-x-3 mt-5">
            <Button color={ButtonColor.White} onClick={handleCancel}>
              Cancel
            </Button>
            <Button color={ButtonColor.Black} type="submit">
              Create Suite
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NewActionSuitePage;
