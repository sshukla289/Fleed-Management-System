interface MapViewProps {
  title: string
  stops: string[]
}

export function MapView({ title, stops }: MapViewProps) {
  return (
    <section className="panel map-view">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p className="muted">Route overview for stop sequencing and vehicle position context.</p>
        </div>
      </div>
      <div className="map-view__canvas">
        <div className="map-view__route-line" />
        {stops.map((stop, index) => (
          <div
            key={stop}
            className="map-view__marker"
            style={{ left: `${12 + index * (68 / Math.max(stops.length - 1, 1))}%` }}
            title={stop}
          />
        ))}
      </div>
      <div className="map-view__stops">
        {stops.map((stop) => (
          <span key={stop} className="badge">
            {stop}
          </span>
        ))}
      </div>
    </section>
  )
}
