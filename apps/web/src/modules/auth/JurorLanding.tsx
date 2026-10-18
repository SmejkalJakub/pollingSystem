import { AppHeader } from '@/components/AppHeader';

export function JurorLanding({ notice }: { notice?: string }) {
  return (
    <>
      <AppHeader section="Pro porotce" />
      <main className="mx-auto max-w-md px-6 py-12 sm:py-24">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Hlasování poroty
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Vstup pro porotce
        </h1>
        {notice && (
          <p role="status" className="mt-4">
            {notice}
          </p>
        )}
        <p className="mt-4 leading-relaxed text-muted-foreground">
          K hlasování použijte svůj osobní odkaz od organizátora akce.
        </p>
        <section
          aria-labelledby="invitation-heading"
          className="mt-8 border border-border bg-card p-6"
        >
          <h2 id="invitation-heading" className="font-medium">
            Váš osobní odkaz
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Každý porotce má vlastní přístup k příslušné akci. Odkaz si ponechte
            pro sebe.
          </p>
        </section>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Nemáte odkaz nebo se vám nedaří vstoupit? Obraťte se na organizátora
          akce.
        </p>
      </main>
    </>
  );
}
