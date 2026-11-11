import { ApiError, apiRequest, requestProblem } from '@/lib/api';

export const adminDataChanged = 'd21:admin-data-changed';

export async function adminRequest<T>(
  ...args: Parameters<typeof apiRequest<T>>
) {
  const result = await apiRequest(...args);
  if (args[2]?.method) {
    window.dispatchEvent(new Event(adminDataChanged));
  }
  return result;
}

export function managementError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'LINK_STORAGE_UNAVAILABLE') {
      return 'Odkaz nelze načíst nebo vytvořit. Organizátor musí obnovit šifrovací klíče serveru. Stávající přístup zůstává zachován.';
    }
    if (error.code === 'LEGACY_LINK') {
      return 'Původní odkaz funguje, ale nelze jej obnovit. Pro budoucí kopírování výslovně vytvořte náhradní odkaz u porotce; tím zrušíte dosavadní přihlášení.';
    }
    if (error.code === 'NO_ACTIVE_LINK') {
      return 'Porotce nemá aktivní osobní odkaz. Obnovte porotu a zkontrolujte stav odkazu.';
    }
    if (['BALLOT_CONFLICT', 'BALLOT_NOT_SUBMITTED'].includes(error.code)) {
      return 'Lístek se změnil. Obnovte lístky, zkontrolujte aktuální stav a potvrďte znovu.';
    }
    if (error.code === 'REVISION_EXHAUSTED') {
      return 'Lístek dosáhl limitu změn a nelze jej odemknout.';
    }
    if (error.code === 'JUROR_CREATE_CONFLICT') {
      return 'Toto ID členství už existuje s jinými údaji. Obnovte porotu a zkontrolujte aktuální stav.';
    }
    if (error.code === 'ROSTER_LOCKED') {
      return 'Po zahájení hlasování lze přidat nové porotce a opravit jména. Stávající porotce nelze přesunout ani odebrat. Obnovte přehled.';
    }
    if (error.code === 'GROUP_EXISTS') {
      return 'Tato část poroty již v eventu existuje.';
    }
    if (error.code === 'VOTING_NOT_EDITABLE') {
      return 'Toto hlasování již nelze upravovat jako koncept. Obnovte přehled.';
    }
    if (error.code === 'INVALID_TEAM') {
      return 'Vyberte soutěžní tým z tohoto eventu.';
    }
    if (error.code === 'ITEM_EXISTS') {
      return 'Tento tým už v hlasování je. Obnovte seznam položek.';
    }
    if (error.code === 'INVALID_VOTING_STATUS') {
      return 'Stav hlasování již tuto operaci neumožňuje. Obnovte přehled.';
    }
    if (error.code === 'INVALID_GROUP') {
      return 'Vyberte část poroty patřící do tohoto eventu.';
    }
    if (error.code === 'CONFIGURATION_NOT_READY') {
      return 'V uložené kategorii chybí platná pravidla. Zavřete potvrzení a v části „Před aktivací zbývá“ přejděte přímo na pole k opravě.';
    }
    if (error.code === 'ITEMS_NOT_READY') {
      return 'Uložené týmy nesplňují podmínky pro aktivaci. Zavřete potvrzení, klikněte na „Obnovit nastavení“ a postupujte podle pokynů nad formulářem.';
    }
    if (error.code === 'GROUPS_NOT_READY') {
      return 'V uložené kategorii není vybraná porota. Zavřete potvrzení, v části „Oprávněná porota“ vyberte alespoň jednu možnost a uložte kategorii.';
    }
    if (error.code === 'MEMBERSHIP_REFERENCED') {
      return 'Členství má navázané záznamy a nelze je odebrat.';
    }
  }
  return requestProblem(error);
}
