// src/components/RegionalSelector.jsx
import { useState } from 'react'
import { REGIONALS } from '../constants/regionals'
import { useAuth } from '../contexts/AuthContext'
import './RegionalSelector.css'

export default function RegionalSelector() {
    const { completeProfile } = useAuth()
    const [selectedCre, setSelectedCre] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedCre) return

        setLoading(true)
        try {
            await completeProfile(selectedCre)
        } catch (error) {
            console.error('Erro ao salvar CRE:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="regional-selector-overlay">
            <div className="regional-selector-modal">
                <h2>Bem-vindo ao Sistema de Verificação de PPP</h2>
                <p>Por favor, selecione sua Coordenação Regional de Ensino (CRE)</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">CRE</label>
                        <select
                            className="form-select"
                            value={selectedCre}
                            onChange={(e) => setSelectedCre(e.target.value)}
                            required
                        >
                            <option value="">Selecione uma CRE...</option>
                            {REGIONALS.map(regional => (
                                <option key={regional.id} value={regional.code}>
                                    {regional.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Salvando...' : 'Confirmar'}
                    </button>
                </form>
            </div>
        </div>
    )
}