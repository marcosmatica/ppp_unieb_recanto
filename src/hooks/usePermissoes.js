// src/hooks/usePermissoes.js

import { useAuth } from '../contexts/AuthContext'

// Roles: 'ci' (coordenador intermediário), 'supervisor', 'admin'
// ci      → vê apenas suas próprias visitas
// supervisor → vê todas as visitas da CRE, não cria
// admin   → vê tudo, pode tudo

export function usePermissoes() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'ci'

  return {
    podecriarVisita:    role === 'ci' || role === 'admin',
    podeCriarSessao:    role === 'ci' || role === 'admin',
    podeCriarPlano:     role === 'ci' || role === 'admin',
    podeEditarPlano:    role === 'ci' || role === 'admin',
    podeVerDashboard:   true,
    podeVerTodasCRE:    role === 'supervisor' || role === 'admin',
    podeEncerrarVisita: role === 'ci' || role === 'admin',

    // Filtragem de escolas visíveis
    filtroCRE: (role === 'supervisor' || role === 'admin') ? profile?.cre : null,
    filtroCI:  role === 'ci' ? profile?.uid : null,

    role,
    profile,
  }
}
