// src/hooks/usePermissoes.js

import { useAuth } from '../contexts/AuthContext'

export function usePermissoes() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'analyst'

  return {
    isAdmin:      role === 'admin',
    isSupervisor: role === 'supervisor' || role === 'admin',
    isAnalyst:    role === 'analyst',
    role,
    podeEditar:   role !== 'analyst' || true,
    podeAprovar:  role === 'supervisor' || role === 'admin',
    podeVerTudo:  role === 'admin',

    podeEditarParecer:    ['analyst','supervisor','admin'].includes(role),
    podeFinalizarParecer: ['supervisor','admin'].includes(role),
    podeReabrirParecer:   ['supervisor','admin'].includes(role),
  }
}
