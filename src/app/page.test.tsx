import { describe, expect, it } from "@jest/globals";

import Home from "./page";

describe("Home", () => {
  it("renders the homepage greeting", () => {
    expect(Home()).toEqual(
      <main>
        <p>hello from up - remastered</p>
      </main>,
    );
  });
});
