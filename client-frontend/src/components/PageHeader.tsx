interface PageHeaderProps {
  eyebrow: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <div className="page-header__eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel ? (
        <button
          className="page-header__action"
          disabled={actionDisabled}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
