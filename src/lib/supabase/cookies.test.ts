import { describe, expect, it } from "vitest";

import { AUTH_COOKIE_MAX_AGE, capCookieOptions } from "./cookies";

describe("capCookieOptions", () => {
  it("caps the library's 400-day lifetime", () => {
    expect(capCookieOptions({ maxAge: 400 * 24 * 60 * 60, path: "/" })).toEqual({ maxAge: AUTH_COOKIE_MAX_AGE, path: "/" });
  });
  it("keeps deletions and shorter lifetimes", () => {
    expect(capCookieOptions({ maxAge: 0 }).maxAge).toBe(0);
    expect(capCookieOptions({ maxAge: 60 }).maxAge).toBe(60);
  });
  it("adds the cap when no lifetime is given", () => {
    expect(capCookieOptions({}).maxAge).toBe(AUTH_COOKIE_MAX_AGE);
  });
});
