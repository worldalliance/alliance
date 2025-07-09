import { useEffect, useState } from "react";
import { Outlet } from "react-router";

export default function TempProdPassword() {
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [granted, setGranted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (password === "ally") {
      setGranted(true);
      localStorage.setItem("prod-login", "true");
    }
  }, [password, mounted]);

  if (!mounted) return null;

  const bypass =
    import.meta.env.MODE === "development" ||
    localStorage.getItem("prod-login") ||
    granted;

  if (bypass) return <Outlet />;

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <form>
        <input
          className="p-2 rounded-md border-2 border-gray-300"
          type="password"
          placeholder="Enter password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </form>
    </div>
  );
}
