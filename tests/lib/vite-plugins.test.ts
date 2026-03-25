import { describe, expect, it } from "vitest";
import { createAppPlugins } from "../../vite.plugins";

function getPluginNames(isTest: boolean): string[] {
  return createAppPlugins({ isTest })
    .flat()
    .map((plugin) => plugin?.name)
    .filter((name): name is string => Boolean(name));
}

describe("createAppPlugins", () => {
  it("omits Nitro plugins during Vitest runs", () => {
    expect(getPluginNames(true).some((name) => name.startsWith("nitro:"))).toBe(
      false
    );
  });

  it("keeps Nitro plugins for normal app builds", () => {
    expect(
      getPluginNames(false).some((name) => name.startsWith("nitro:"))
    ).toBe(true);
  });
});
