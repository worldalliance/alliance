import { downloadBlob } from "./downloadBlob";

afterEach(() => jest.restoreAllMocks());

it("clicks a link that downloads the blob under the file name, then frees it", () => {
  const blob = new Blob(["a,b"]);
  const create = jest
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:fake");
  const revoke = jest
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => {});
  const clicked: { href: string; download: string; attached: boolean }[] = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({
      href: this.href,
      download: this.download,
      attached: this.isConnected,
    });
  });

  downloadBlob(blob, "form-responses.csv");

  expect(create).toHaveBeenCalledWith(blob);
  expect(clicked).toEqual([
    { href: "blob:fake", download: "form-responses.csv", attached: true },
  ]);
  expect(revoke).toHaveBeenCalledWith("blob:fake");
  expect(document.querySelector("a")).toBeNull();
});
