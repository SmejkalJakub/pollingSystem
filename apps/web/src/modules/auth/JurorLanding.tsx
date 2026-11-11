import { useId, type ReactNode, type Ref } from 'react';

export function JurorEntryLayout({
  title,
  headingRef,
  busy,
  children,
}: {
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  busy?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="juror-entry">
      <header className="wizard-header">
        <div className="wizard-header-inner juror-entry-header">
          <span className="wizard-wordmark">D21</span>
          <span>Hlasování poroty</span>
        </div>
      </header>
      <main
        id="main"
        className="juror-entry-main"
        aria-busy={busy}
        aria-labelledby={id}
      >
        <div className="juror-entry-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
        </div>
        <h1 id={id} ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

export function JurorLanding({
  notice,
  headingRef,
}: {
  notice?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <JurorEntryLayout title="Vstup pro porotce" headingRef={headingRef}>
      {notice && <p role="status">{notice}</p>}
      <p>K hlasování použijte svůj osobní odkaz od organizátora akce.</p>
      <p className="juror-entry-note">
        Každý porotce má vlastní přístup k příslušné akci. Odkaz si ponechte pro
        sebe.
      </p>
      <p>
        Nemáte odkaz nebo se vám nedaří vstoupit? Obraťte se na organizátora
        akce.
      </p>
    </JurorEntryLayout>
  );
}
