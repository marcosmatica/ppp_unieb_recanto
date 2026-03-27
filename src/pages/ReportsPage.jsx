// src/pages/ReportsPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { analysesService } from '../services/firebase'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileDown, CheckCircle2, XCircle, FileText, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import './ReportsPage.css'

export default function ReportsPage() {
    const { profile } = useAuth()
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [downloadingId, setDownloadingId] = useState(null)

    useEffect(() => {
        if (!profile?.cre) return
        const fetch = async () => {
            // Busca todas as análises da CRE e filtra as que têm finalReport
            const allAnalyses = await analysesService.getByCRE(profile.cre)
            const withReport = allAnalyses.filter(a => a.finalReport?.generatedAt)
            // Ordena por data de geração (mais recente primeiro)
            withReport.sort((a, b) => {
                const dateA = a.finalReport?.generatedAt?.toDate?.() || new Date(0)
                const dateB = b.finalReport?.generatedAt?.toDate?.() || new Date(0)
                return dateB - dateA
            })
            setReports(withReport)
            setLoading(false)
        }
        fetch()
    }, [profile])

    const handleDownload = async (report) => {
        const storagePath = report.finalReport?.storagePath
        if (!storagePath) {
            toast.error('Caminho do arquivo não encontrado')
            return
        }
        setDownloadingId(report.id)
        try {
            const storage = getStorage()
            const fileRef = ref(storage, storagePath)
            const url = await getDownloadURL(fileRef)

            // Criar link temporário para download
            const a = document.createElement('a')
            a.href = url
            a.download = `parecer_${report.schoolName.replace(/\s+/g, '_')}_${report.year}.docx`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            toast.success('Download iniciado')
        } catch (err) {
            console.error(err)
            toast.error('Erro ao obter o arquivo. Pode ter expirado ou não existe mais.')
        } finally {
            setDownloadingId(null)
        }
    }

    if (loading) {
        return <div className="page-loader"><div className="spinner" /></div>
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pareceres</h1>
                    <p className="page-sub">
                        {reports.length} parecer{reports.length !== 1 ? 'es' : ''} gerado{reports.length !== 1 ? 's' : ''} · {profile?.cre}
                    </p>
                </div>
            </div>

            {reports.length === 0 ? (
                <div className="empty-state">
                    <FileText size={32} className="empty-icon" />
                    <p>Nenhum parecer foi gerado ainda.</p>
                    <p className="empty-hint">
                        Após concluir a revisão de uma análise, acesse a aba "Gerar parecer".
                    </p>
                </div>
            ) : (
                <div className="reports-list">
                    {reports.map((report) => {
                        const decision = report.finalReport?.decision
                        const generatedAt = report.finalReport?.generatedAt?.toDate?.()
                        const dateLabel = generatedAt
                            ? formatDistanceToNow(generatedAt, { locale: ptBR, addSuffix: true })
                            : 'Data desconhecida'

                        return (
                            <div key={report.id} className="report-card animate-fade-in">
                                <div className="report-card-main">
                                    <div className="report-info">
                                        <p className="report-school">{report.schoolName}</p>
                                        <p className="report-meta">
                                            {report.cre} · PPP {report.year}
                                        </p>
                                    </div>
                                    <div className="report-decision">
                                        {decision === 'approved_with_remarks' ? (
                                            <span className="decision-badge approved">
                        <CheckCircle2 size={14} /> Aprovado com ressalvas
                      </span>
                                        ) : decision === 'rejected' ? (
                                            <span className="decision-badge rejected">
                        <XCircle size={14} /> Reprovado
                      </span>
                                        ) : (
                                            <span className="decision-badge unknown">
                        <AlertCircle size={14} /> Pendente
                      </span>
                                        )}
                                    </div>
                                    <div className="report-actions">
                                        <button
                                            className="btn-download"
                                            onClick={() => handleDownload(report)}
                                            disabled={downloadingId === report.id}
                                        >
                                            {downloadingId === report.id ? (
                                                <div className="spinner-sm" />
                                            ) : (
                                                <FileDown size={16} />
                                            )}
                                            Baixar
                                        </button>
                                    </div>
                                </div>
                                <div className="report-footer">
                  <span className="report-date">
                    Gerado {dateLabel}
                  </span>
                                    {report.finalReport?.analystNotes && (
                                        <span className="report-notes-indicator" title={report.finalReport.analystNotes}>
                      📝 Com observações
                    </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}