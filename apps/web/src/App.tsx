import { useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AuthScreen } from '@/modules/auth/AuthScreen';
import { JurorPortal } from '@/modules/voting-wizard/JurorPortal';

export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const adminLogin =
    path === '/admin/login' ||
    path === '/admin/events' ||
    /^\/admin\/events\/[0-9a-f-]{36}\/(dashboard|results)$/i.test(path) ||
    /^\/admin\/results\/votings\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/admin\/dashboard\/votings\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/admin\/(events|votings)\/[0-9a-f-]{36}$/i.test(path);
  useEffect(() => {
    document.title = adminLogin ? 'D21 — Administrace' : 'D21 — Hlasování';
  }, [adminLogin]);

  if (adminLogin) return <AuthScreen />;
  const step = /^\/wizard\/steps\/([0-9a-f-]{36})$/i.exec(path);
  if (
    path === '/' ||
    path === '/wizard' ||
    step ||
    path === '/wizard/review' ||
    path === '/wizard/confirmation'
  )
    return (
      <JurorPortal
        stepId={step?.[1]}
        reviewPage={
          path === '/wizard/review' || path === '/wizard/confirmation'
        }
        confirmationPage={path === '/wizard/confirmation'}
      />
    );
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
