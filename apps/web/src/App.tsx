import { useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AuthScreen } from '@/modules/auth/AuthScreen';
import { JurorLanding } from '@/modules/auth/JurorLanding';

export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const adminLogin = path === '/admin/login';
  useEffect(() => {
    document.title = adminLogin ? 'D21 — Administrace' : 'D21 — Hlasování';
  }, [adminLogin]);

  if (adminLogin) return <AuthScreen />;
  if (path === '/') return <JurorLanding />;
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-6 py-12 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          Stránka nenalezena
        </h1>
        <a
          href="/"
          className="mt-6 inline-flex min-h-11 items-center underline underline-offset-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Zpět na úvod
        </a>
      </main>
    </>
  );
}
