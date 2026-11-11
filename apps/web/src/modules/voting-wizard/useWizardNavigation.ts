import { useCallback, useEffect, useRef, useState } from 'react';

export const reviewPath = '/wizard/review';
export const stepPath = (id: string) => `/wizard/steps/${id}`;
export const wizardPath = () =>
  window.location.pathname.replace(/\/+$/, '') || '/';

export function isWizardTab(path: string) {
  return (
    path === '/wizard' ||
    path === reviewPath ||
    path === '/wizard/confirmation' ||
    /^\/wizard\/steps\/[0-9a-f-]{36}$/i.test(path)
  );
}

type Destination = { path: string; offset?: number };

export function useWizardNavigation() {
  const [path, setPath] = useState(wizardPath);
  const [pending, setPending] = useState<Destination>();
  const position = useRef<number>(window.history.state?.wizardPosition ?? 0);
  const restoring = useRef<{ prompt?: Destination } | null>(null);
  const unsaved = useRef(false);
  const working = useRef(false);

  const setGuard = useCallback((dirty: boolean, busy: boolean) => {
    unsaved.current = dirty;
    working.current = busy;
  }, []);

  const commit = useCallback(
    (destination: string) => {
      setGuard(false, false);
      setPending(undefined);
      setPath(destination);
      window.scrollTo(0, 0);
    },
    [setGuard],
  );

  const replace = useCallback(
    (destination: string) => {
      window.history.replaceState(
        { wizardPosition: position.current },
        '',
        destination,
      );
      commit(destination);
    },
    [commit],
  );

  useEffect(() => {
    window.history.replaceState({ wizardPosition: position.current }, '');
    function onPop(event: PopStateEvent) {
      const destination = wizardPath();
      const next = event.state?.wizardPosition;
      if (window.location.hash || typeof next !== 'number') {
        return;
      }
      if (restoring.current && next === position.current) {
        const { prompt } = restoring.current;
        restoring.current = null;
        if (prompt) {
          setPending(prompt);
        }
        return;
      }
      const offset = next - position.current;
      if (offset && (unsaved.current || working.current)) {
        // Restore the current history entry before offering a return to the target.
        restoring.current = {
          prompt: unsaved.current ? { path: destination, offset } : undefined,
        };
        window.history.go(-offset);
        return;
      }
      position.current = next;
      commit(destination);
    }
    window.addEventListener('popstate', onPop);
    const previousScroll = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.removeEventListener('popstate', onPop);
      window.history.scrollRestoration = previousScroll;
    };
  }, [commit]);

  function navigate(destination: string, approved = false) {
    if (destination === path || restoring.current) {
      return;
    }
    if (!approved && (unsaved.current || working.current)) {
      if (unsaved.current) {
        setPending({ path: destination });
      }
      return;
    }
    position.current += 1;
    window.history.pushState(
      { wizardPosition: position.current },
      '',
      destination,
    );
    commit(destination);
  }

  function isBlocked() {
    return unsaved.current || working.current;
  }

  function followPending() {
    if (!pending || restoring.current) {
      return;
    }
    if (pending.offset !== undefined) {
      setGuard(false, false);
      setPending(undefined);
      window.history.go(pending.offset);
    } else {
      navigate(pending.path, true);
    }
  }

  return {
    path,
    replace,
    navigate,
    setGuard,
    isBlocked,
    pending,
    followPending,
  };
}
