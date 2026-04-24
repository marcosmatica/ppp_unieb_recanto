// src/components/parecer/ParecerStatusBar.jsx

import { Sparkles, Check, User as UserIcon, X, Lock, Unlock, Plus } from 'lucide-react'

export default function ParecerStatusBar({
  observations,
  parecerStatus,
  podeFinalizar,
  podeReabrir,
  podeEditar,
  selectMode,
  onToggleSelect,
  onFinalizar,
  onReabrir,
  finalizing,
}) {
  const counts = {
    auto:      observations.filter(o => o.status === 'auto').length,
    confirmed: observations.filter(o => o.status === 'confirmed').length,
    manual:    observations.filter(o => o.status === 'manual').length,
    rejected:  observations.filter(o => o.status === 'rejected').length,
  }

  const finalized = parecerStatus === 'finalizado'
  const pending = counts.auto

  return (
    <div className={`parecer-status ${finalized ? 'is-finalized' : ''}`}>
      <div className="ps-counts">
        <span className="ps-count ps-auto" title="Geradas pela IA, aguardando revisão">
          <Sparkles size={12} /> <b>{counts.auto}</b> pendentes
        </span>
        <span className="ps-count ps-confirmed" title="Revisadas e aceitas">
          <Check size={12} /> <b>{counts.confirmed}</b> confirmadas
        </span>
        <span className="ps-count ps-manual" title="Adicionadas manualmente">
          <UserIcon size={12} /> <b>{counts.manual}</b> manuais
        </span>
        {counts.rejected > 0 && (
          <span className="ps-count ps-rejected" title="Rejeitadas">
            <X size={12} /> <b>{counts.rejected}</b> rejeitadas
          </span>
        )}
      </div>

      <div className="ps-actions">
        {podeEditar && !finalized && (
          <button
            className={`btn-secondary ${selectMode ? 'is-active' : ''}`}
            onClick={onToggleSelect}
          >
            <Plus size={13} /> {selectMode ? 'Cancelar ancoragem' : 'Nova observação'}
          </button>
        )}

        {finalized ? (
          <>
            <span className="ps-finalized-badge">
              <Lock size={12} /> Parecer finalizado
            </span>
            {podeReabrir && (
              <button className="btn-ghost" onClick={onReabrir} disabled={finalizing}>
                <Unlock size={13} /> Reabrir
              </button>
            )}
          </>
        ) : (
          podeFinalizar && (
            <button
              className="btn-primary"
              onClick={onFinalizar}
              disabled={finalizing || pending > 0}
              title={pending > 0 ? `Revise as ${pending} observações pendentes antes de finalizar` : 'Travar parecer'}
            >
              <Lock size={13} /> {finalizing ? 'Finalizando…' : 'Finalizar parecer'}
            </button>
          )
        )}
      </div>
    </div>
  )
}
