import { useEffect, useState } from "react";

const TempProdPassword: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [password, setPassword] = useState("");
  const [putPassword, setPutPassword] = useState(false);

  useEffect(() => {
    if (password === "ally") {
      setPutPassword(true);
      localStorage.setItem("prod-login", "true");
    }
  }, [password]);

  if (import.meta.env.MODE === "development") {
    return <>{children}</>;
  }

  if (localStorage.getItem("prod-login")) {
    return <>{children}</>;
  }

  if (!putPassword) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <input
          className="p-2 rounded-md border-2 border-gray-300"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default TempProdPassword;
