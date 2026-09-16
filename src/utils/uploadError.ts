export function getUploadError(status: number, payload: unknown): string {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const detail = typeof data.message === 'string' ? data.message
    : typeof data.error === 'string' ? data.error : '';
  const reason = detail.trim().slice(0, 500);
  if (/file.*size|size.*limit|too large|maximum.*size/i.test(reason) || status === 413) {
    const bytesLimit = reason.match(/exceeds\s+(\d+)\s+bytes\s+limit/i);
    if (bytesLimit) {
      const megabytes = Number(bytesLimit[1]) / (1024 * 1024);
      if (Number.isFinite(megabytes) && megabytes > 0) {
        return `O serviço de armazenamento permite apenas ${Number(megabytes.toFixed(2))} MB por ficheiro nesta conta. Para enviar até 50 MB, é necessário aumentar o limite da conta de armazenamento. Pode tentar novamente com um ficheiro menor.`;
      }
    }
    return `O ficheiro excede o limite permitido pela conta de armazenamento. O limite de 50 MB no formulário não altera o limite do serviço.${reason ? ` Detalhe: ${reason}` : ''}`;
  }
  if (/signature|token|expire|public.?key|authentication/i.test(reason)) {
    return `O serviço rejeitou a autorização do envio. Tente novamente; se persistir, verifique as chaves de configuração. Detalhe: ${reason}`;
  }
  return `Falha no envio (HTTP ${status}). ${reason || 'O serviço não forneceu detalhes. Tente novamente.'}`;
}
