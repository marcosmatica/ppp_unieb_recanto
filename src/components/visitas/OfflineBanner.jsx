// src/components/visitas/OfflineBanner.jsx

import './OfflineBanner.css'

export default function OfflineBanner({ isOnline }) {
  if (isOnline) return null

  return (
    <div className="offline-banner" role="alert">
      <span className="offline-banner__icon">!</span>
      <div className="offline-banner__text">
        <strong>Sem conexão</strong>
        <span>Suas respostas estão salvas nesta tela. Não feche a aba até reconectar.</span>
      </div>
    </div>
  )
}
