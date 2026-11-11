import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminWorkspace } from '@/modules/admin/AdminWorkspace';
import type { SessionResponse } from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, authRequest, requestProblem } from '@/lib/api';

type State = SessionResponse | 'loading' | 'unavailable';
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
        if (!controller.signal.aborted) {
          setState(session);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(requestProblem(cause));
          setState('unavailable');
        }
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);
  useEffect(() => {
    if (authenticated) {
      headingRef.current?.focus();
    }
  }, [authenticated]);
  useEffect(() => {
    if (!expiresAt) {
      return;
    }
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
      if (document.visibilityState !== 'visible') {
        return;
      }
      authRequest('/auth/session', { signal: controller.signal })
        .then((session) => {
          if (!controller.signal.aborted) {
            setState(session);
            if (!session.authenticated) {
              setNotice(
                'Přihlášení již není platné. Přihlaste se prosím znovu.',
              );
            }
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
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const session = await authRequest('/auth/admin/login', { password });
      setPassword('');
      setVisible(false);
      setState(session);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? 'Heslo není správné. Zkuste to znovu.'
          : `Přihlášení se nezdařilo. ${requestProblem(cause)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authRequest('/auth/logout', { logout: true });
      setState({ authenticated: false });
      setNotice('Byli jste odhlášeni.');
    } catch (cause) {
      setError(`Odhlášení se nepodařilo potvrdit. ${requestProblem(cause)}`);
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
      className="mt-2 text-sm leading-relaxed text-destructive outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {error}
    </p>
  );

  if (authenticated && state.principal.kind === 'admin') {
    return (
      <AdminWorkspace
        onExpired={onExpired}
        logout={logout}
        busy={busy}
        error={errorNotice}
      />
    );
  }

  let content;
  if (state === 'loading') {
    content = (
      <p role="status" className="mt-8 text-muted-foreground">
        Ověřujeme přihlášení…
      </p>
    );
  } else if (state === 'unavailable') {
    content = (
      <section className="feedback-error mt-8" aria-label="Ověření přihlášení">
        <p className="feedback-error-title">Přihlášení se nepodařilo ověřit</p>
        {errorNotice}
        <Button
          className="mt-5 min-h-11"
          onClick={() => {
            setError('');
            setState('loading');
            setAttempt((value) => value + 1);
          }}
        >
          Zkusit znovu
        </Button>
      </section>
    );
  } else if (authenticated) {
    content = (
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
          {state.expiresAt ? (
            <>
              Přihlášení platí do{' '}
              {new Intl.DateTimeFormat('cs-CZ', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(state.expiresAt))}
              .{' '}
            </>
          ) : (
            'Přihlášení nemá časové omezení.'
          )}
        </p>
        <Button
          className="mt-6 min-h-11 w-full"
          disabled={busy}
          onClick={logout}
        >
          {busy ? 'Odhlašování…' : 'Odhlásit se'}
        </Button>
      </section>
    );
  } else {
    content = (
      <>
        <p
          id="login-help"
          className="mt-4 leading-relaxed text-muted-foreground"
        >
          Pro organizátory a garanty. Porotci se přihlašují svým osobním
          odkazem.
        </p>
        <form
          onSubmit={login}
          aria-describedby="login-help"
          aria-busy={busy}
          className="mt-5"
        >
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium">
              Heslo
            </label>
            <Button
              type="button"
              variant="link"
              className="min-h-11 px-0"
              disabled={busy}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? 'Skrýt heslo' : 'Zobrazit heslo'}
            </Button>
          </div>
          <Input
            className="min-h-12 rounded-[10px] border-control-border"
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
            type="submit"
            disabled={busy}
            className="mt-4 min-h-12 w-full rounded-xl"
          >
            {busy ? 'Přihlašování…' : 'Přihlásit se'}
          </Button>
        </form>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Přihlášení platí 12 hodin.
        </p>
      </>
    );
  }

  return (
    <div className="admin-login-page">
      <main id="main" className="admin-login-card">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="admin-brand admin-login-brand">D21</span>
          Administrace
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="page-title outline-none">
          {authenticated ? 'Jste přihlášeni.' : 'Přihlášení'}
        </h1>
        {notice && (
          <p
            role="status"
            className="mt-4 text-sm leading-relaxed text-muted-foreground"
          >
            {notice}
          </p>
        )}
        {content}
        {authenticated && errorNotice}
      </main>
    </div>
  );
}
