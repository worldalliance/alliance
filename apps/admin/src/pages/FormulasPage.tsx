import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useFormulasAdmin } from "../lib/useFormulasAdmin";

const FormulasPage: React.FC = () => {
  const formulas = useFormulasAdmin();
  const usedBy = (id: string) =>
    (formulas.data ?? []).filter((formula) => formula.reads.includes(id))
      .length;

  return (
    <div className="p-5 space-y-4">
      <title>Formulas - Admin</title>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Formulas</h1>
          <p className="text-sm text-zinc-600 mt-1 max-w-3xl">
            Named conditions and values that other rules can reuse. A change
            that would break a formula reading this one is refused until you fix
            both.
          </p>
        </div>
        <Button to="/formulas/new" color={ButtonColor.Black} size="small">
          New formula
        </Button>
      </div>
      {formulas.isPending ? (
        <p className="text-sm text-zinc-600" role="status">
          Loading formulas…
        </p>
      ) : formulas.isError ? (
        <p className="text-sm text-red-700" role="alert">
          {adminRefusalMessage(formulas.error, "Couldn't load formulas.")}
        </p>
      ) : formulas.data.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No formulas yet. Create one to reuse a condition or value across
          rules.
        </p>
      ) : (
        <table className="text-sm w-full max-w-4xl">
          <thead>
            <tr className="text-left text-zinc-600 border-b border-zinc-200">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Formula</th>
              <th className="py-2 pr-4 font-medium">Used by</th>
              <th className="py-2 font-medium">Last saved</th>
            </tr>
          </thead>
          <tbody>
            {formulas.data.map((formula) => (
              <tr key={formula.id} className="border-b border-zinc-100">
                <td className="py-2 pr-4">
                  <Link
                    to={`/formulas/${formula.id}`}
                    className="font-mono underline text-zinc-900"
                  >
                    {formula.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <div className="font-mono text-zinc-700 truncate max-w-md">
                    {formula.text}
                  </div>
                </td>
                <td className="py-2 pr-4 text-zinc-700">
                  {usedBy(formula.id)}
                </td>
                <td className="py-2 text-zinc-700">
                  {formatDateTime(new Date(formula.updatedAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FormulasPage;
