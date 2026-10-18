import { useEffect, useRef, useState } from 'react';
import {
  jurorStartSchema,
  jurorStartResponseSchema,
  wizardCurrentSchema,
  wizardStepDetailSchema,
  wizardReviewSchema,
  type WizardCurrent,
  type WizardStepDetail,
  type WizardReview,
} from '@d21/contracts';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { ApiError, apiRequest, authRequest } from '@/lib/api';
import { JurorLanding } from '@/modules/auth/JurorLanding';
import { WizardContent } from './WizardContent';

function readLink() {
  if (!window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const value = jurorStartSchema.safeParse({
    eventId: params.get('event'),
    token: params.get('key'),
  });
  return value.success ? value.data : 'invalid';
}
function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_JUROR_LINK')
      return 'Osobní odkaz není platný nebo byl zrušen. Požádejte organizátora o nový.';
    if (error.status === 401)
      return 'Přihlášení již není dostupné nebo bylo zrušeno. Otevřete znovu svůj osobní odkaz od organizátora.';
    if (error.status === 404)
      return 'Tato kategorie není dostupná. Vraťte se na přehled svých kategorií.';
    if (error.status === 403)
      return 'Pro tento přehled použijte osobní odkaz porotce od organizátora.';
    if (error.status === 429)
      return 'Příliš mnoho pokusů. Chvíli počkejte a zkuste to znovu.';
  }
  return 'Spojení se serverem se nezdařilo. Zkontrolujte připojení a zkuste to znovu.';
}

export function JurorPortal({
  stepId,
  reviewPage = false,
  confirmationPage = false,
}: {
  stepId?: string;
  reviewPage?: boolean;
  confirmationPage?: boolean;
}) {
  const [link, setLink] = useState(readLink);
  const [data, setData] = useState<{
    current: WizardCurrent;
    detail?: WizardStepDetail;
    review?: WizardReview;
  }>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(!link);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loggedOut, setLoggedOut] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const atRoot = window.location.pathname === '/';
  const expiresAt = data?.current.expiresAt;

  useEffect(() => {
    const capture = () => {
      const incoming = readLink();
      if (!incoming) return;
      setLink(incoming);
      setData(undefined);
      setError(undefined);
      setLoggedOut(false);
      setLoading(false);
      // Strip the secret before any API call, including same-document links.
      window.history.replaceState(null, '', window.location.pathname);
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);
  useEffect(() => {
    if (link || loggedOut) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = reviewPage
          ? await apiRequest('/wizard/review', wizardReviewSchema, {
              signal: controller.signal,
            }).then((review) => ({ current: review.current, review }))
          : stepId
            ? await apiRequest(
                `/wizard/steps/${stepId}`,
                wizardStepDetailSchema,
                { signal: controller.signal },
              ).then((detail) => ({ current: detail.current, detail }))
            : await apiRequest('/wizard/current', wizardCurrentSchema, {
                signal: controller.signal,
              }).then((current) => ({ current }));
        if (!controller.signal.aborted) {
          setData(result);
          setError(undefined);
          setLoading(false);
          setRefreshing(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          if (
            cause instanceof ApiError &&
            [401, 403, 404].includes(cause.status)
          )
            setData(undefined);
          setError(cause);
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [stepId, reviewPage, attempt, link, loggedOut]);
  useEffect(() => {
    if (error) feedback.current?.focus();
    else if (!loading) heading.current?.focus();
  }, [error, loading, link]);
  useEffect(() => {
    const timer = expiresAt
      ? window.setTimeout(
          () => {
            setData(undefined);
            setError(new ApiError(401, 'UNAUTHENTICATED'));
          },
          Math.max(0, Date.parse(expiresAt) - Date.now()),
        )
      : undefined;
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setAttempt((x) => x + 1);
      }
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [expiresAt]);

  async function enter() {
    if (!link || link === 'invalid' || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest('/auth/juror/start', jurorStartResponseSchema, {
        method: 'POST',
        body: link,
      });
      setLink(null);
      window.location.replace('/wizard');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError(undefined);
    try {
      await authRequest('/auth/logout', { logout: true });
      setData(undefined);
      setLoggedOut(true);
      window.history.replaceState(null, '', '/');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  if (loggedOut)
    return (
      <JurorLanding notice="Byli jste odhlášeni. Pro návrat otevřete svůj osobní odkaz." />
    );
  if (
    !link &&
    !data &&
    !loading &&
    atRoot &&
    error instanceof ApiError &&
    [401, 403].includes(error.status)
  )
    return <JurorLanding />;
  return (
    <>
      <AppHeader section="Hlasování poroty" />
      <main
        id="main"
        className="mx-auto max-w-5xl px-6 py-8 sm:py-12"
        aria-busy={loading || busy}
      >
        {link ? (
          <section className="mx-auto max-w-md py-4 sm:py-12">
            <p className="eyebrow">Váš osobní přístup</p>
            <h1
              ref={heading}
              tabIndex={-1}
              className="mt-3 text-3xl font-semibold tracking-tight outline-none"
            >
              Vstup pro porotce
            </h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Odkaz vás přihlásí k příslušné akci. Ponechte si jej pro opětovný
              návrat a nikomu jej nepředávejte.
            </p>
            {link === 'invalid' ? (
              <p role="alert" className="mt-6 text-destructive">
                Odkaz není úplný nebo má nesprávný formát. Požádejte
                organizátora o nový osobní odkaz.
              </p>
            ) : (
              <Button
                className="mt-8 min-h-11 w-full"
                onClick={enter}
                disabled={busy}
              >
                {busy ? 'Přihlašujeme…' : 'Pokračovat k přehledu'}
              </Button>
            )}
          </section>
        ) : loading ? (
          <p role="status" className="py-16 text-muted-foreground">
            Načítáme váš přístup a kategorie…
          </p>
        ) : (
          data && (
            <WizardContent
              current={data.current}
              detail={data.detail}
              review={data.review}
              confirmationPage={confirmationPage}
              headingRef={heading}
              logout={logout}
              busy={busy}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setAttempt((x) => x + 1);
              }}
              onAccessError={(cause) => {
                setData(undefined);
                setError(cause);
              }}
            />
          )
        )}
        {!link && !data && !loading && (
          <h1 className="mt-8 text-3xl font-semibold tracking-tight">
            Přístup ke hlasování
          </h1>
        )}
        {error !== undefined && (
          <section
            className="mt-6 border border-border bg-card p-6"
            aria-label="Přístup se nepodařilo ověřit"
          >
            <p
              ref={feedback}
              tabIndex={-1}
              role="alert"
              className="leading-relaxed outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {errorText(error)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => {
                  if (link) void enter();
                  else {
                    setLoading(!data);
                    setError(undefined);
                    setAttempt((x) => x + 1);
                  }
                }}
              >
                Zkusit znovu
              </Button>
              {!link && (
                <a className="wizard-link" href="/wizard">
                  Přehled kategorií
                </a>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
