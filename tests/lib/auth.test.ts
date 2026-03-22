import { describe, expect, it, vi } from "vitest";
import { initializeAuthSession } from "~/lib/auth";

describe("initializeAuthSession", () => {
  it("hydrates the current session and subscribes to future auth changes", async () => {
    const onSession = vi.fn();
    const unsubscribe = vi.fn();
    let authListener: ((event: string, session: { user: { id: string } } | null) => void) | null =
      null;

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
        }),
        onAuthStateChange: vi.fn().mockImplementation((listener) => {
          authListener = listener;
          return {
            data: {
              subscription: {
                unsubscribe,
              },
            },
          };
        }),
      },
    };

    const cleanup = await initializeAuthSession(client as any, onSession);

    expect(onSession).toHaveBeenCalledWith({ user: { id: "user-1" } });

    authListener?.("SIGNED_IN", { user: { id: "user-2" } });
    expect(onSession).toHaveBeenLastCalledWith({ user: { id: "user-2" } });

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
