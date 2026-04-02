import type { TelemetryData } from '../types'

interface TelemetryChartProps {
  title: string
  metric: keyof Pick<TelemetryData, 'speed' | 'fuelUsage' | 'engineTemperature'>
  data: TelemetryData[]
}

export function TelemetryChart({ title, metric, data }: TelemetryChartProps) {
  const maxValue = Math.max(...data.map((point) => point[metric]), 1)

  return (
    <section className="panel chart">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p className="muted">Telemetry trend built from the latest vehicle data stream.</p>
        </div>
      </div>
      <div className="chart__bars">
        {data.map((point) => {
          const rawValue = point[metric]

          return (
            <div key={`${metric}-${point.timestamp}`} className="chart__column">
              <div
                aria-label={`${title} at ${point.timestamp}`}
                className="chart__bar"
                style={{ height: `${Math.max((rawValue / maxValue) * 160, 14)}px` }}
              />
              <strong>{rawValue}</strong>
              <span className="chart__label">{point.timestamp}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
