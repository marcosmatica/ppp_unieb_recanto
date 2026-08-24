import { STATUS_INSCRICAO } from '../../constants/feiraConstants'

const COR_MAP = {
  gray: { bg: '#f3f4f6', text: '#374151' },
  blue: { bg: '#dbeafe', text: '#1d4ed8' },
  yellow: { bg: '#fef3c7', text: '#92400e' },
  orange: { bg: '#ffedd5', text: '#c2410c' },
  green: { bg: '#dcfce7', text: '#166534' },
  red: { bg: '#fee2e2', text: '#991b1b' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
}

export default function StatusBadge({ status }) {
  const info = STATUS_INSCRICAO[status] ?? { label: status, cor: 'gray' }
  const cores = COR_MAP[info.cor] ?? COR_MAP.gray
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      backgroundColor: cores.bg,
      color: cores.text,
    }}>
      {info.label}
    </span>
  )
}
