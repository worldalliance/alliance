import { R } from "@alliance/common/result";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";

const NewActionSuitePage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createSuite } = useActionSuitesAdmin();

  const handleCancel = () => {
    navigate("/actions");
  };

  const handleCreateSuite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    const suiteName = name.trim();
    if (!suiteName) return;
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

  const nameError = submitted && !name.trim() ? "Give the suite a name." : null;

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <Card className="p-6">
        <form onSubmit={handleCreateSuite} className="space-y-4">
          <h1 className="font-bold">Create a new action suite</h1>
          <label htmlFor="suiteName" className="block text-sm font-medium">
            Suite name
          </label>
          <input
            type="text"
            id="suiteName"
            name="suiteName"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "suiteNameError" : undefined}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {nameError && (
            <p
              id="suiteNameError"
              role="alert"
              className="text-sm text-red-600"
            >
              {nameError}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
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
