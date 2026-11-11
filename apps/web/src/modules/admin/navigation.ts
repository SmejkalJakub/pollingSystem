import { useEffect, useState } from 'react';

const changeEvent = 'd21:open-admin-page';
const unsaved = new Set<symbol>();
const route = () => window.location.pathname + window.location.search;
const confirmLeave = () =>
  !unsaved.size ||
  window.confirm(
    'Máte neuložené změny nebo probíhá ukládání. Opustit stránku?',
  );

export function useAdminLeaveWarning(blocked: boolean) {
  useEffect(() => {
    if (!blocked) return;
    const key = Symbol();
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    unsaved.add(key);
    window.addEventListener('beforeunload', warn);
    return () => {
      unsaved.delete(key);
      window.removeEventListener('beforeunload', warn);
    };
  }, [blocked]);
}

// A successful create has already saved its data; do not run the old editor's leave guard.
export function openSavedAdminPage(path: string) {
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: path }));
}

export function useAdminNavigation() {
  const [location, setLocation] = useState(route);
  useEffect(() => {
    let current = route();
    let index = Number(window.history.state?.d21AdminIndex ?? 0);
    let restoring = false;
    window.history.replaceState(
      { ...window.history.state, d21AdminIndex: index },
      '',
    );
    function update(path: string) {
      current = path;
      setLocation(path);
      document.getElementById('main')?.focus({ preventScroll: true });
    }
    function push(path: string) {
      if (restoring || path === current) return;
      window.history.pushState({ d21AdminIndex: ++index }, '', path);
      update(path);
      window.scrollTo(0, 0);
    }
    function click(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target ||
        anchor.hasAttribute('download')
      )
        return;
      const url = new URL(anchor.href);
      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith('/admin/') ||
        url.hash
      )
        return;
      event.preventDefault();
      const path = url.pathname + url.search;
      if (!restoring && path !== current && confirmLeave()) push(path);
    }
    function pop(event: PopStateEvent) {
      const next = route();
      const targetIndex = event.state?.d21AdminIndex;
      if (restoring) {
        restoring = false;
        if (next === current) return;
      }
      if (next === current) {
        // Native in-page links create their own history entry.
        if (typeof targetIndex === 'number') index = targetIndex;
        else window.history.replaceState({ d21AdminIndex: ++index }, '');
        return;
      }
      if (typeof targetIndex === 'number' && !confirmLeave()) {
        restoring = true;
        window.history.go(index - targetIndex);
        return;
      }
      if (typeof targetIndex === 'number') index = targetIndex;
      update(next);
    }
    const saved = (event: Event) => push((event as CustomEvent<string>).detail);
    document.addEventListener('click', click);
    window.addEventListener('popstate', pop);
    window.addEventListener(changeEvent, saved);
    return () => {
      document.removeEventListener('click', click);
      window.removeEventListener('popstate', pop);
      window.removeEventListener(changeEvent, saved);
    };
  }, []);
  return location;
}
