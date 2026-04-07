import { getRoleLabel } from '@/utils/roles.ts';

const ACTION_LABELS: Record<string, string> = {
  'create-book': 'Criou livro',
  'update-book': 'Atualizou livro',
  'create-course': 'Criou curso',
  'update-course': 'Atualizou curso',
  'renumber-course': 'Renumero de curso',
  'approve-transaction': 'Aprovou emprestimo',
  'reject-transaction': 'Rejeitou emprestimo',
  'return-transaction': 'Registou devolucao',
  'update-user-role': 'Atualizou perfil de utilizador',
  'create-user-role': 'Criou perfil de utilizador',
  'apply-overdue-sanction': 'Aplicou multa por atraso',
};

const ENTITY_LABELS: Record<string, string> = {
  book: 'Livro',
  course: 'Curso',
  transaction: 'Transacao',
  user: 'Utilizador',
};

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');

export const getAuditActionLabel = (action: string | null | undefined) => {
  const normalized = String(action || '').trim().toLowerCase();
  if (!normalized) return 'Acao desconhecida';
  return ACTION_LABELS[normalized] || toTitleCase(normalized);
};

export const getAuditEntityLabel = (entityType: string | null | undefined) => {
  const normalized = String(entityType || '').trim().toLowerCase();
  if (!normalized) return 'Entidade';
  return ENTITY_LABELS[normalized] || toTitleCase(normalized);
};

export const getAuditRoleLabel = (role: string | null | undefined) => getRoleLabel(role);

export const getAuditSearchText = (log: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  details?: string | null;
}) =>
  [
    log.actorUserId,
    log.actorRole,
    getAuditRoleLabel(log.actorRole),
    log.action,
    getAuditActionLabel(log.action),
    log.entityType,
    getAuditEntityLabel(log.entityType),
    log.entityId,
    log.details,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
