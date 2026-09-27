import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

import { CreateRequestForm } from "./create-request-form";

describe("CreateRequestForm", () => {
  it("keeps initial server and hydration markup independent of the clock", () => {
    const clock = jest.spyOn(Date, "now");
    clock.mockReturnValueOnce(1).mockReturnValueOnce(9_999_999);

    const first = renderToString(
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024 ** 3}
      />,
    );
    const second = renderToString(
      <CreateRequestForm
        maxExpirationMs={24 * 60 * 60_000}
        maxUploadBytes={1024 ** 3}
      />,
    );

    expect(second).toBe(first);
    expect(first).toContain("Server maximum:");
    expect(first).toContain("1 GiB");
    clock.mockRestore();
  });
});
