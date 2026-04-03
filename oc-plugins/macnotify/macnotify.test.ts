import { describe, expect, it } from "bun:test"

describe("macnotify plugin", () => {
  it("exports the plugin function", async () => {
    const mod = await import("./macnotify.ts")

    expect(typeof mod.OpenCodeMacNotify).toBe("function")
    expect(mod.default).toBe(mod.OpenCodeMacNotify)
  })
})
