type SessionLike = { user: { id: string } } | null;

type AuthClientLike = {
  auth: {
    getSession: () => Promise<{ data: { session: SessionLike } }>;
    onAuthStateChange: (
      listener: (_event: string, session: SessionLike) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
};

export async function initializeAuthSession(
  client: AuthClientLike,
  onSession: (session: SessionLike) => void
): Promise<() => void> {
  const {
    data: { session },
  } = await client.auth.getSession();

  onSession(session);

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, nextSession) => {
    onSession(nextSession);
  });

  return () => subscription.unsubscribe();
}
