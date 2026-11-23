import { render, screen } from "@testing-library/react";
import MarkedDiagnostics from "./MarkedDiagnostics";

it("marks each diagnostic's span in the text, and an empty span with a placeholder", () => {
  render(
    <MarkedDiagnostics
      text="a + b"
      diagnostics={[
        { message: "Unknown name.", start: 4, end: 5 },
        { message: "Missing value.", start: 5, end: 5 },
      ]}
    />,
  );
  const [unknown, missing] = screen.getAllByRole("listitem");
  expect(unknown.querySelector("p")?.textContent).toBe("Unknown name.");
  expect(unknown.querySelector("pre")?.textContent).toBe("a + b");
  expect(unknown.querySelector("mark")?.textContent).toBe("b");
  expect(missing.querySelector("pre")?.textContent).toBe("a + b␣");
  expect(missing.querySelector("mark")?.textContent).toBe("␣");
});
