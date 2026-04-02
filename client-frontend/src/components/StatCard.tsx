interface StatCardProps {
  label: string
  value: string
  trend: string
}

export function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="stat-card card">
      <div className="stat-card__label">{label}</div>
      <strong className="stat-card__value">{value}</strong>
      <div className="stat-card__trend">{trend}</div>
    </div>
  )
}
