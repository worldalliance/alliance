it("prints a DOM node in a failed expectation as its markup", () => {
  const node = document.createElement("div");
  node.setAttribute("role", "group");

  expect(() => expect(node).toBeNull()).toThrow(
    'Received: <div role="group"></div>',
  );
});
