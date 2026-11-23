import { render } from "@testing-library/react";
import { MmsThreadsLiveContext, OFFLINE } from "../../lib/mmsThreadsLive";
import ComposingNotice, { replyingLabel } from "./ComposingNotice";

it("names who is replying", () => {
  expect(replyingLabel([])).toBeNull();
  expect(replyingLabel(["Sam"])).toBe("Sam is replying…");
  expect(replyingLabel(["Sam", "Priya"])).toBe("Sam and Priya are replying…");
});

it("keeps an announced notice mounted while nobody is replying", () => {
  const { getByRole } = render(<ComposingNotice phoneNumber="+14155550101" />);
  expect(getByRole("status").textContent).toBe("");
});

it("renders an unannounced notice only while someone is replying", () => {
  const live = {
    ...OFFLINE,
    connected: true,
    composers: [{ phoneNumber: "+14155550101", adminId: 2, adminName: "Sam" }],
  };
  const { container, rerender } = render(
    <ComposingNotice phoneNumber="+14155550102" announce={false} />,
  );
  expect(container.innerHTML).toBe("");
  rerender(
    <MmsThreadsLiveContext.Provider value={live}>
      <ComposingNotice phoneNumber="+14155550101" announce={false} />
    </MmsThreadsLiveContext.Provider>,
  );
  expect(container.textContent).toBe("Sam is replying…");
});
