import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LibraryApp } from "@/components/library/library-app";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-fg">
        <p className="text-sm text-muted">Đang mở thư viện…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <LibraryApp />;
}
