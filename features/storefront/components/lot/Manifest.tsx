type Line = { id: string; lineNumber: number; category: string; manufacturer: string; model: string; partNumber: string; description: string; specs: Record<string, unknown>; cosmeticGrade: string; functionalGrade: string; quantity: number; unit: string; serials: string[]; notes: string }

function specText(specs: Record<string, unknown>) {
  return Object.entries(specs || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')
}

/** U3: the full manifest. Serial numbers fold away per line. */
export function Manifest({ lines }: { lines: Line[] }) {
  return (
    <div className="ar-table-wrap">
      <table className="ar-table">
        <thead>
          <tr><th scope="col">Line</th><th scope="col">Item</th><th scope="col">Specs</th><th scope="col">Grade</th><th scope="col" className="ar-num">Qty</th></tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td data-label="Line">{l.lineNumber}</td>
              <td data-label="Item">
                <strong>{[l.manufacturer, l.model].filter(Boolean).join(' ') || l.description}</strong>
                {l.manufacturer || l.model ? <div className="ar-small ar-muted">{l.description}</div> : null}
                {l.notes ? <div className="ar-small ar-muted">{l.notes}</div> : null}
                {l.serials.length ? (
                  <details className="ar-small" style={{ marginTop: 4 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--ar-yellow)' }}>{l.serials.length} serial numbers</summary>
                    <p className="ar-muted" style={{ wordBreak: 'break-all', marginTop: 4 }}>{l.serials.join(', ')}</p>
                  </details>
                ) : null}
              </td>
              <td data-label="Specs" className="ar-small">{specText(l.specs) || '—'}</td>
              <td data-label="Grade">{[l.cosmeticGrade, l.functionalGrade].filter(Boolean).join(' / ') || '—'}</td>
              <td data-label="Qty" className="ar-num">{l.quantity} {l.unit && l.unit !== 'each' ? l.unit : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
