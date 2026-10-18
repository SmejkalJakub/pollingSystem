import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminWorkspace } from '@/modules/admin/AdminWorkspace';
import type { SessionResponse } from '@d21/contracts';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, authRequest } from '@/lib/api';

type State = SessionResponse | 'loading' | 'unavailable';
function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Heslo není správné. Zkuste to znovu.';
    if (error.status === 429 || error.code === 'AUTH_BUSY')
      return 'Příliš mnoho pokusů. Chvíli počkejte a zkuste to znovu.';
    if (error.status === 403)
      return 'Přihlášení z této adresy není povoleno. Použijte adresu aplikace od organizátora.';
  }
  return 'Spojení se serverem se nezdařilo. Zkuste to znovu.';
}

export function AuthScreen() {
  const [state, setState] = useState<State>('loading');
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const authenticated = typeof state === 'object' && state.authenticated;
  const expiresAt = authenticated ? state.expiresAt : undefined;
  const onExpired = useCallback(() => {
    setState({ authenticated: false });
    setNotice('Přihlášení již není platné. Přihlaste se prosím znovu.');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    authRequest('/auth/session', { signal: controller.signal })
      .then((session) => {
        if (!controller.signal.aborted) setState(session);
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('unavailable');
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (authenticated) headingRef.current?.focus();
  }, [authenticated]);
  useEffect(() => {
    if (!expiresAt) return;
    const expire = () => {
      setState({ authenticated: false });
      setNotice('Přihlášení vypršelo. Přihlaste se prosím znovu.');
    };
    const timer = window.setTimeout(
      expire,
      Math.max(0, new Date(expiresAt).getTime() - Date.now()),
    );
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      authRequest('/auth/session', { signal: controller.signal })
        .then((session) => {
          if (!controller.signal.aborted) {
            setState(session);
            if (!session.authenticated)
              setNotice(
                'Přihlášení již není platné. Přihlaste se prosím znovu.',
              );
          }
        })
        .catch(() => {
          /* Keep the current identity until expiry; protected API calls remain authoritative. */
        });
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [expiresAt]);

  async function login(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const session = await authRequest('/auth/admin/login', { password });
      setPassword('');
      setVisible(false);
      setState(session);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await authRequest('/auth/logout', { logout: true });
      setState({ authenticated: false });
      setNotice('Byli jste odhlášeni.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const errorNotice = error && (
    <p
      id="login-error"
      ref={errorRef}
      tabIndex={-1}
      role="alert"
      className="mt-5 text-sm leading-relaxed text-destructive outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {error}
    </p>
  );

  if (authenticated && state.principal.kind === 'admin')
    return (
      <AdminWorkspace
        onExpired={onExpired}
        logout={logout}
        busy={busy}
        error={errorNotice}
      />
    );

  return (
    <>
      <AppHeader section="Administrace" />
      <main id="main" className="mx-auto max-w-md px-6 py-12 sm:py-24">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Pro organizátory a garanty
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
        >
          {authenticated ? 'Jste přihlášeni.' : 'Vstup do administrace'}
        </h1>
        {notice && (
          <p
            role="status"
            className="mt-4 text-sm leading-relaxed text-muted-foreground"
          >
            {notice}
          </p>
        )}
        {state === 'loading' ? (
          <p role="status" className="mt-8 text-muted-foreground">
            Ověřujeme přihlášení…
          </p>
        ) : state === 'unavailable' ? (
          <section
            className="mt-8 border border-border bg-card p-6"
            aria-label="Připojení není dostupné"
          >
            <p role="alert">
              Server není dostupný. Přihlášení se nepodařilo ověřit.
            </p>
            <Button
              className="mt-5 min-h-11"
              onClick={() => {
                setState('loading');
                setAttempt((value) => value + 1);
              }}
            >
              Zkusit znovu
            </Button>
          </section>
        ) : authenticated ? (
          <section
            className="mt-8 border border-border bg-card p-6"
            aria-label="Přihlášená administrace"
          >
            <p className="font-medium">{state.principal.displayName}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {state.principal.kind === 'admin'
                ? 'Přístup pro správu a garanci je aktivní.'
                : 'Přístup porotce je aktivní. Administrace je dostupná pouze organizátorům.'}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Přihlášení platí do{' '}
              {new Intl.DateTimeFormat('cs-CZ', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(state.expiresAt))}
              .
            </p>
            <Button
              className="mt-6 min-h-11 w-full"
              disabled={busy}
              onClick={logout}
            >
              {busy ? 'Odhlašování…' : 'Odhlásit se'}
            </Button>
          </section>
        ) : (
          <>
            <p
              id="login-help"
              className="mt-4 leading-relaxed text-muted-foreground"
            >
              Zadejte společné heslo, které jste dostali od organizátora.
            </p>
            <form
              onSubmit={login}
              aria-describedby="login-help"
              aria-busy={busy}
              className="mt-8 border border-border bg-card p-6"
            >
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Heslo
              </label>
              <Input
                id="password"
                name="password"
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                maxLength={256}
                disabled={busy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
              {errorNotice}
              <Button
                type="button"
                variant="ghost"
                className="mt-1 min-h-11 px-0 text-sm"
                disabled={busy}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? 'Skrýt heslo' : 'Zobrazit heslo'}
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="mt-4 min-h-11 w-full"
              >
                {busy ? 'Přihlašování…' : 'Přihlásit se'}
              </Button>
            </form>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Nemáte heslo? Obraťte se na organizátora akce.
            </p>
          </>
        )}
        {authenticated && errorNotice}
      </main>
    </>
  );
}
