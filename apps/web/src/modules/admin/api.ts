import { ApiError } from '@/lib/api';
export { apiRequest as adminRequest } from '@/lib/api';

export function managementError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'LINK_STORAGE_UNAVAILABLE')
      return 'Odkaz nelze načíst nebo vytvořit. Organizátor musí obnovit šifrovací klíče serveru. Stávající přístup zůstává zachován.';
    if (error.code === 'LEGACY_LINK')
      return 'Původní odkaz funguje, ale nelze jej obnovit. Pro budoucí kopírování výslovně vytvořte náhradní odkaz v Osobním přístupu; tím zrušíte dosavadní přihlášení.';
    if (error.code === 'NO_ACTIVE_LINK')
      return 'Porotce nemá aktivní osobní odkaz. Vytvořte jej v Osobním přístupu.';
    if (error.status === 401) return 'Přihlášení vypršelo. Přihlaste se znovu.';
    if (error.status === 403)
      return 'K této operaci nemáte přístup. Použijte adresu aplikace od organizátora.';
    if (error.status === 404)
      return 'Záznam nebyl nalezen. Obnovte seznam a zkuste to znovu.';
    if (['BALLOT_CONFLICT', 'BALLOT_NOT_SUBMITTED'].includes(error.code))
      return 'Lístek se změnil. Obnovte lístky, zkontrolujte aktuální stav a potvrďte znovu.';
    if (error.code === 'REVISION_EXHAUSTED')
      return 'Lístek dosáhl limitu změn a nelze jej odemknout.';
    if (error.code === 'ROSTER_LOCKED')
      return 'Složení poroty je uzamčeno, protože již začalo hlasování nebo existují hlasovací lístky. Obnovte přehled.';
    if (error.code === 'GROUP_EXISTS')
      return 'Tato část poroty již v eventu existuje.';
    if (error.code === 'VOTING_NOT_EDITABLE')
      return 'Toto hlasování již nelze upravovat jako koncept. Obnovte přehled.';
    if (error.code === 'INVALID_TEAM')
      return 'Vyberte soutěžní tým z tohoto eventu.';
    if (error.code === 'ITEM_EXISTS')
      return 'Tento tým už v hlasování je. Obnovte seznam položek.';
    if (error.code === 'INVALID_VOTING_STATUS')
      return 'Stav hlasování již tuto operaci neumožňuje. Obnovte přehled.';
    if (error.code === 'INVALID_GROUP')
      return 'Vyberte část poroty patřící do tohoto eventu.';
    if (error.code === 'CONFIGURATION_NOT_READY')
      return 'Nejprve nastavte platný počet míst a limity kladných a záporných hlasů.';
    if (error.code === 'ITEMS_NOT_READY')
      return 'Propojte všechny položky s týmy eventu. Počet týmů musí být větší než počet míst i součet hlasovacích limitů.';
    if (error.code === 'GROUPS_NOT_READY')
      return 'Vyberte alespoň jednu oprávněnou část poroty.';
    if (error.code === 'ROSTER_NOT_READY')
      return 'Poroty T a V musí mít stejný počet členů: 5, 7 nebo 9 v každé. Doplňte porotu v detailu eventu.';
    if (error.code === 'MEMBERSHIP_REFERENCED')
      return 'Členství má navázané záznamy a nelze je odebrat.';
    if (error.status === 400)
      return 'Zkontrolujte vyplněná pole a zkuste to znovu.';
  }
  return 'Spojení se serverem se nezdařilo. Zkuste to znovu.';
}
