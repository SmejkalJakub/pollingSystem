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
import { Button } from '@/components/ui/button';
import { ApiError, apiRequest, authRequest, requestProblem } from '@/lib/api';
import { JurorEntryLayout, JurorLanding } from '@/modules/auth/JurorLanding';
import { WizardContent } from './WizardContent';
import {
  reviewPath,
  stepPath,
  useWizardNavigation,
} from './useWizardNavigation';

type WizardData = {
  path: string;
  current: WizardCurrent;
  detail?: WizardStepDetail;
  review?: WizardReview;
  rail?: WizardReview;
};

function initialCategory(current: WizardCurrent) {
  const first = current.steps.find(
    (step) => step.status === 'active' && step.progress !== 'submitted',
  );
  return first ? stepPath(first.id) : reviewPath;
}

async function loadWizard(
  path: string,
  signal: AbortSignal,
): Promise<WizardData> {
  if (path === reviewPath || path === '/wizard/confirmation') {
    const review = await apiRequest('/wizard/review', wizardReviewSchema, {
      signal,
    });
    return { path, current: review.current, review };
  }
  if (path.startsWith('/wizard/steps/')) {
    const [detail, rail] = await Promise.all([
      apiRequest(path, wizardStepDetailSchema, { signal }),
      apiRequest('/wizard/review', wizardReviewSchema, { signal }).catch(
        () => undefined,
      ),
    ]);
    return { path, current: detail.current, detail, rail };
  }
  const current = await apiRequest('/wizard/current', wizardCurrentSchema, {
    signal,
  });
  return { path, current };
}

function readLink() {
  if (!window.location.hash) {
    return null;
  }
  const params = new URLSearchParams(window.location.hash.slice(1));
  const value = jurorStartSchema.safeParse({
    eventId: params.get('event'),
    token: params.get('key'),
  });
  return value.success ? value.data : 'invalid';
}
function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_JUROR_LINK') {
      return 'Osobní odkaz není platný nebo byl zrušen. Požádejte organizátora o nový.';
    }
    if (error.status === 401) {
      return 'Přihlášení již není dostupné nebo bylo zrušeno. Otevřete znovu svůj osobní odkaz od organizátora.';
    }
    if (error.status === 404) {
      return 'Tato kategorie není dostupná. Vraťte se na přehled svých kategorií.';
    }
    if (error.status === 403) {
      return 'Pro tento přehled použijte osobní odkaz porotce od organizátora.';
    }
    if (error.status === 429) {
      return 'Příliš mnoho pokusů. Chvíli počkejte a zkuste to znovu.';
    }
  }
  return requestProblem(error);
}

export function JurorPortal() {
  const navigation = useWizardNavigation();
  const { path, replace } = navigation;
  const [link, setLink] = useState(readLink);
  const [data, setData] = useState<WizardData>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(!link);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loggedOut, setLoggedOut] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const skipInitialLoad = useRef(false);
  const loadedPath = data?.path;
  const atRoot = path === '/';
  const expiresAt = data?.current.expiresAt;

  useEffect(() => {
    const capture = () => {
      const incoming = readLink();
      if (!incoming) {
        return;
      }
      setLink(incoming);
      setData(undefined);
      setError(undefined);
      setLoggedOut(false);
      setLoading(false);
      // Strip the secret before any API call, including same-document links.
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname,
      );
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);
  useEffect(() => {
    if (link || loggedOut) {
      return;
    }
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      return;
    }
    const controller = new AbortController();
    async function load() {
      try {
        const result = await loadWizard(path, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        if ((path === '/wizard' || atRoot) && result.current.steps.length) {
          replace(initialCategory(result.current));
        }
        setData(result);
        setError(undefined);
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }
        if (
          cause instanceof ApiError &&
          [401, 403, 404].includes(cause.status)
        ) {
          setData(undefined);
        }
        setError(cause);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [path, atRoot, replace, attempt, link, loggedOut]);
  useEffect(() => {
    if (error || link === 'invalid') {
      (feedback.current ?? heading.current)?.focus();
    } else if (!loading && (!loadedPath || loadedPath === path)) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [error, loading, link, loadedPath, path, loggedOut]);
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
    if (!link || link === 'invalid' || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiRequest(
        '/auth/juror/start',
        jurorStartResponseSchema,
        {
          method: 'POST',
          body: link,
        },
      );
      const destination = result.wizard.steps.length
        ? initialCategory(result.wizard)
        : '/wizard';
      skipInitialLoad.current = destination === '/wizard';
      replace(destination);
      setData({ path: '/wizard', current: result.wizard });
      setLoading(false);
      setLink(null);
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
      replace('/');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  if (loggedOut) {
    return (
      <JurorLanding
        headingRef={heading}
        notice="Byli jste odhlášeni. Pro návrat otevřete svůj osobní odkaz."
      />
    );
  }
  if (
    !link &&
    !data &&
    !loading &&
    atRoot &&
    error instanceof ApiError &&
    [401, 403].includes(error.status)
  ) {
    return <JurorLanding headingRef={heading} />;
  }

  const accessFeedback =
    !link && error !== undefined ? (
      <section
        className="feedback-error m-4"
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
              setLoading(!data);
              setError(undefined);
              setAttempt((x) => x + 1);
            }}
          >
            Zkusit znovu
          </Button>
          <a className="wizard-link" href="/wizard">
            Přehled kategorií
          </a>
        </div>
      </section>
    ) : null;

  if (data && !link) {
    const loaded = data.path === path;
    return (
      <WizardContent
        key={data.current.principal.id}
        current={data.current}
        detail={loaded ? data.detail : undefined}
        review={loaded ? data.review : undefined}
        rail={data.review ?? data.rail}
        navigation={navigation}
        loading={!loaded && !error}
        headingRef={heading}
        logout={logout}
        busy={busy}
        refreshing={refreshing}
        feedback={accessFeedback}
        onRefresh={() => {
          setRefreshing(true);
          setAttempt((x) => x + 1);
        }}
        onAccessError={(cause) => {
          setData(undefined);
          setError(cause);
        }}
      />
    );
  }
  if (!link) {
    return (
      <JurorEntryLayout
        title="Přístup ke hlasování"
        headingRef={heading}
        busy={loading}
      >
        {loading && <p role="status">Načítáme váš přístup a kategorie…</p>}
        {accessFeedback}
      </JurorEntryLayout>
    );
  }
  if (link === 'invalid' || error !== undefined) {
    return (
      <JurorEntryLayout title="Vstup pro porotce" headingRef={heading}>
        <p ref={feedback} tabIndex={-1} className="feedback-error" role="alert">
          {link === 'invalid'
            ? 'Odkaz není úplný nebo má nesprávný formát. Požádejte organizátora o nový osobní odkaz.'
            : errorText(error)}
        </p>
        {link !== 'invalid' &&
          !(
            error instanceof ApiError && error.code === 'INVALID_JUROR_LINK'
          ) && <p>Chcete-li to zkusit znovu, otevřete svůj osobní odkaz.</p>}
        <p>Nejde to? Obraťte se na organizátora akce.</p>
      </JurorEntryLayout>
    );
  }
  return (
    <JurorEntryLayout title="Vítejte v porotě" headingRef={heading} busy={busy}>
      <p>Po pokračování uvidíte své kategorie a můžete hned hlasovat.</p>
      <ol className="juror-entry-steps" role="list">
        <li>
          <span aria-hidden="true">1</span>Rozdejte kladné (a případně záporné)
          hlasy týmům.
        </li>
        <li>
          <span aria-hidden="true">2</span>Rozpracovaný výběr si můžete uložit a
          vrátit se později.
        </li>
        <li>
          <span aria-hidden="true">3</span>Každou kategorii odevzdáte zvlášť.
          Odevzdané hlasy se uzamknou.
        </li>
      </ol>
      <div className="juror-entry-actions">
        <p className="juror-entry-note">
          Odkaz si ponechte pro návrat a nikomu jej nepředávejte.
        </p>
        <Button type="button" onClick={enter} disabled={busy}>
          {busy ? 'Přihlašujeme…' : 'Pokračovat k hlasování'}
        </Button>
        <p>Nejde to? Obraťte se na organizátora akce.</p>
      </div>
    </JurorEntryLayout>
  );
}
