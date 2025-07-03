import { useEffect, useState } from "react";
import { Outlet } from "react-router";

export default function TempProdPassword() {
  const [password, setPassword] = useState("");
  const [putPassword, setPutPassword] = useState(false);

  useEffect(() => {
    if (password === "ally") {
      setPutPassword(true);
      localStorage.setItem("prod-login", "true");
    }
  }, [password]);

  if (import.meta.env.MODE === "development") {
    return <Outlet />;
  }

  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("prod-login")
  ) {
    return <Outlet />;
  }

  if (!putPassword) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <form>
          <input
            className="p-2 rounded-md border-2 border-gray-300"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </form>
      </div>
    );
  }

  return <Outlet />;
}
