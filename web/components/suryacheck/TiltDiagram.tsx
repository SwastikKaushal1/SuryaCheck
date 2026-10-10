/** Side view of the chosen tilt, with the sun low in winter, to show why rows need a gap. */
export function TiltDiagram({ tilt, sunElevation }: { tilt: number; sunElevation: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const L = 50 // panel length, drawing units
  const g = 74 // ground line
  const x0 = 34
  const run = L * Math.cos(rad(tilt))
  const rise = L * Math.sin(rad(tilt))
  const shadow = Math.min(70, rise / Math.tan(rad(Math.max(sunElevation, 8))))
  const x1 = x0 + run // top of panel 1 (north side), ground x below it
  const x2 = x1 + shadow // where row 2 can safely start
  const width = Math.max(x2 + run + 14, 190)
  const sunX = x0 - 22
  const sunY = g - (x1 - sunX) * Math.tan(rad(sunElevation))
  return (
    <svg viewBox={`0 0 ${width} 100`} className="h-auto w-full max-w-[280px]" role="img" aria-label={`Side view: panels tilted ${tilt} degrees facing south, with a gap between rows so they do not shade each other`}>
      <line x1="6" y1={g} x2={width - 6} y2={g} stroke="#a89880" strokeWidth="2" strokeLinecap="round" />
      {/* sun ray grazing the top of row 1 and landing where row 2 starts */}
      <line x1={sunX} y1={Math.max(6, sunY)} x2={x2} y2={g} stroke="#F59E0B" strokeWidth="1.4" strokeDasharray="4 3" />
      <circle cx={sunX - 2} cy={Math.max(8, sunY - 2)} r="6" fill="#FBBF24" />
      {[x0, x2].map((x, i) => (
        <g key={i}>
          <line x1={x} y1={g} x2={x + run} y2={g - rise} stroke="#1e3a8a" strokeWidth="5" strokeLinecap="round" />
          <line x1={x} y1={g} x2={x + run} y2={g - rise} stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" />
          <line x1={x + run * 0.5} y1={g - rise * 0.5} x2={x + run * 0.5 + 6} y2={g} stroke="#94a3b8" strokeWidth="1.2" />
        </g>
      ))}
      <path d={`M${x0 + 18} ${g} A18 18 0 0 0 ${x0 + 18 * Math.cos(rad(tilt))} ${g - 18 * Math.sin(rad(tilt))}`} fill="none" stroke="#0F5C5E" strokeWidth="1.4" />
      <text x={x0 + 22} y={g - 6} fontSize="9" fontWeight="800" fill="#0F5C5E">
        {tilt}°
      </text>
      <text x={x1 + 2} y={g + 12} fontSize="8" fontWeight="700" fill="#6a5a49">
        row gap stops shading
      </text>
      <text x="6" y="11" fontSize="8" fontWeight="700" fill="#6a5a49">
        South
      </text>
      <text x={width - 6} y="11" fontSize="8" fontWeight="700" fill="#6a5a49" textAnchor="end">
        North
      </text>
    </svg>
  )
}
