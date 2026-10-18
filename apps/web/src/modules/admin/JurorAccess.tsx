import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  jurorAccessStatusSchema,
  jurorLinkSchema,
  type JurorRecord,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { adminRequest } from './api';
import { MutationForm } from './MutationForm';
import { ResourceState } from './ResourceState';
import { useResource } from './useResource';

export function JurorAccess({
  juror,
  onExpired,
  close,
  onMutating,
  onChanged,
}: {
  juror: JurorRecord;
  onExpired: () => void;
  close: () => void;
  onMutating: () => void;
  onChanged: () => void;
}) {
  const path = `/events/${juror.eventId}/jurors/${juror.id}/access`;
  const resource = useResource(path, jurorAccessStatusSchema, onExpired);
  const [action, setAction] = useState<'issue' | 'revoke' | null>(null);
  const [url, setUrl] = useState('');
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const link = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (url) link.current?.focus();
  }, [url]);
  useEffect(() => {
    if (notice && !url) heading.current?.focus();
  }, [notice, url]);
  return (
    <section
      className="mt-6 border border-border bg-card p-6"
      aria-labelledby="access-heading"
    >
      <h3
        id="access-heading"
        ref={heading}
        tabIndex={-1}
        className="break-words text-xl font-semibold outline-none"
      >
        Osobní přístup: {juror.displayName}
      </h3>
      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
        ID {juror.id}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Odkaz i přihlášení nemají časové omezení. Stejný odkaz umožňuje návrat i
        přístup z více zařízení. Prohlížeč může přihlášení zapomenout; v takovém
        případě znovu otevřete osobní odkaz. Odkaz doručte porotci soukromě.
      </p>
      <ResourceState resource={resource} />
      {notice && (
        <p className="mt-4 text-sm" role="status">
          {notice}
        </p>
      )}
      {url && (
        <div className="mt-6 border-l-2 border-primary pl-4">
          <label htmlFor="personal-link" className="block font-medium">
            Nový osobní odkaz
          </label>
          <p className="mt-2 text-sm text-muted-foreground">
            Stejný aktivní odkaz lze kdykoli zkopírovat přímo u porotce v
            seznamu. Kopírování nemění přihlášení.
          </p>
          <textarea
            id="personal-link"
            ref={link}
            readOnly
            value={url}
            rows={4}
            className="mt-3 min-h-11 w-full resize-y break-all rounded-md border border-input p-3 text-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            className="mt-3 min-h-11"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setNotice(
                  'Odkaz byl zkopírován. Předejte jej pouze příslušnému porotci.',
                );
              } catch {
                link.current?.focus();
                link.current?.select();
                setNotice(
                  'Odkaz označen. Zkopírujte jej pomocí Ctrl+C nebo ⌘C.',
                );
              }
            }}
          >
            Kopírovat odkaz
          </Button>
        </div>
      )}
      {resource.data && !resource.loading && !resource.error && (
        <>
          <p className="mt-5 text-sm">
            {resource.data.issued
              ? 'Osobní odkaz je vydán.'
              : 'Porotce nemá platný osobní odkaz.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={action !== null}
              onClick={() => setAction('issue')}
            >
              {resource.data.issued
                ? 'Vytvořit náhradní odkaz'
                : 'Vytvořit osobní odkaz'}
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={action !== null}
              onClick={() => setAction('revoke')}
            >
              Zrušit přístup a přihlášení
            </Button>
          </div>
        </>
      )}
      {action && (
        <div className="mt-6">
          <MutationForm
            headingLevel={4}
            title={
              action === 'issue'
                ? 'Vytvořit nový osobní odkaz?'
                : 'Zrušit osobní přístup?'
            }
            initial={{}}
            fields={[]}
            schema={z.strictObject({})}
            onExpired={onExpired}
            cancel={() => setAction(null)}
            destructive={action === 'revoke'}
            description="Všechny dosavadní odkazy tohoto porotce a jeho přihlášení na všech zařízeních přestanou platit. Hlasovací údaje zůstanou zachovány."
            submitLabel={
              action === 'issue' ? 'Vytvořit odkaz' : 'Zrušit přístup'
            }
            save={async () => {
              setUrl('');
              onMutating();
              if (action === 'issue') {
                const result = await adminRequest(path, jurorLinkSchema, {
                  method: 'POST',
                  body: {},
                });
                setUrl(result.url);
                setNotice('Nový odkaz je připraven k soukromému předání.');
              } else {
                await adminRequest(`${path}/revoke`, z.undefined(), {
                  method: 'POST',
                  body: {},
                });
                setUrl('');
                setNotice(
                  'Osobní odkazy a všechna přihlášení porotce byla zrušena.',
                );
              }
              setAction(null);
              resource.reload();
              onChanged();
            }}
          />
        </div>
      )}
      {!action && (
        <Button variant="ghost" className="mt-5 min-h-11" onClick={close}>
          Zavřít osobní přístup
        </Button>
      )}
    </section>
  );
}
