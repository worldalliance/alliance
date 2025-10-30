import { actionsCreateSuite } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card from "@alliance/shared/ui/Card";
import { useState } from "react";
import { useNavigate } from "react-router";

const NewActionSuitePage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    navigate("/");
  };

  const handleCreateSuite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const suiteName = formData.get("suiteName") as string;
    const response = await actionsCreateSuite({ body: { name: suiteName } });
    if (response.error) {
      setError((response.error as Error).message as string);
    } else if (response.data) {
      navigate(`/suites/${response.data.id}`);
    }
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
