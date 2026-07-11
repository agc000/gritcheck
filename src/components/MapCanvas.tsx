// Phase 2 static map placeholder, ported from mockup v7's illustrative campus
// SVG — replaced by MapLibre in Phase 3. Deliberately omits the mockup's fake
// live-status glows/dots and "Quiet now" caption: no invented data, ever
// (§0.7); real markers arrive when real statuses exist (Phase 4).
export function MapCanvas() {
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* Sized to the region visible above the default sheet snap — full-height
          slice-scaling would zoom the illustration into crops. */}
      <svg
        viewBox="0 0 430 480"
        preserveAspectRatio="xMidYMin slice"
        className="h-[58%] w-full"
      >
        <rect width="430" height="480" fill="#191813" />
        {/* green spaces */}
        <ellipse cx="50" cy="430" rx="140" ry="90" fill="#1C1F17" />
        <ellipse cx="400" cy="70" rx="120" ry="85" fill="#1C1F17" />
        <ellipse cx="215" cy="235" rx="60" ry="42" fill="#1B1E16" />
        {/* pond */}
        <ellipse cx="330" cy="330" rx="34" ry="20" fill="#16202A" />

        {/* loop road */}
        <ellipse cx="215" cy="240" rx="184" ry="168" fill="none" stroke="#26241E" strokeWidth="16" />
        <ellipse cx="215" cy="240" rx="184" ry="168" fill="none" stroke="#33312A" strokeWidth="1.2" strokeDasharray="3 10" />
        <text x="215" y="62" textAnchor="middle" fontSize="8.5" fill="#514E44" letterSpacing="3" className="font-mono">
          HILLTOP CIRCLE
        </text>

        {/* paths */}
        <path
          d="M130 180 L215 240 L305 168 M215 240 L215 356 M215 240 L136 312 M215 356 L298 322"
          stroke="#242219"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />

        <g fontWeight="600" className="font-sans">
          {/* AOK */}
          <rect x="90" y="146" width="78" height="46" rx="6" fill="#232119" stroke="#38352C" />
          <text x="129" y="166" textAnchor="middle" fontSize="11" fill="#DAD7CE">AOK Library</text>
          <text x="129" y="180" textAnchor="middle" fontSize="9" fill="#77746C">Study · Coffee</text>

          {/* Commons */}
          <rect x="274" y="126" width="82" height="50" rx="6" fill="#232119" stroke="#38352C" />
          <text x="315" y="147" textAnchor="middle" fontSize="11" fill="#DAD7CE">Commons</text>
          <text x="315" y="161" textAnchor="middle" fontSize="9" fill="#77746C">Dining · Coffee</text>

          {/* ILSB */}
          <rect x="252" y="266" width="66" height="44" rx="6" fill="#232119" stroke="#38352C" />
          <text x="285" y="285" textAnchor="middle" fontSize="11" fill="#DAD7CE">ILSB</text>
          <text x="285" y="299" textAnchor="middle" fontSize="9" fill="#77746C">Study</text>

          {/* True Grit's */}
          <rect x="98" y="270" width="76" height="44" rx="6" fill="#232119" stroke="#38352C" />
          <text x="136" y="289" textAnchor="middle" fontSize="11" fill="#DAD7CE">True Grit&apos;s</text>
          <text x="136" y="303" textAnchor="middle" fontSize="9" fill="#77746C">Dining Hall</text>

          {/* UC */}
          <rect x="196" y="196" width="52" height="34" rx="6" fill="#232119" stroke="#38352C" />
          <text x="222" y="217" textAnchor="middle" fontSize="11" fill="#DAD7CE">UC</text>

          {/* Engineering */}
          <rect x="180" y="378" width="80" height="42" rx="6" fill="#232119" stroke="#38352C" />
          <text x="220" y="396" textAnchor="middle" fontSize="11" fill="#DAD7CE">Engineering</text>
          <text x="220" y="410" textAnchor="middle" fontSize="9" fill="#77746C">Study</text>

          {/* RAC */}
          <rect x="316" y="360" width="58" height="38" rx="6" fill="#232119" stroke="#38352C" />
          <text x="345" y="383" textAnchor="middle" fontSize="11" fill="#DAD7CE">RAC</text>
        </g>
      </svg>

      {/* Top bar: Grits mark + wordmark (mockup .map-top). Visual only (§4.7). */}
      <div className="absolute inset-x-0 top-0 flex items-center px-4 pt-4">
        <div className="flex items-center gap-2 text-[15px] font-extrabold tracking-[0.02em] text-sheet">
          <svg viewBox="0 0 64 64" aria-hidden className="h-5.5 w-5.5">
            <ellipse cx="32" cy="34" rx="20" ry="19" fill="#FFC20E" />
            <path d="M13 26c-3-6 0-14 5-16 2 4 3 8 2 12z" fill="#FFC20E" />
            <path d="M51 26c3-6 0-14-5-16-2 4-3 8-2 12z" fill="#FFC20E" />
            <circle cx="25" cy="30" r="2.6" fill="#121110" />
            <circle cx="39" cy="30" r="2.6" fill="#121110" />
            <ellipse cx="32" cy="39" rx="3" ry="2.2" fill="#121110" />
          </svg>
          <span>
            GRIT<span className="text-gold">CHECK</span>
          </span>
        </div>
      </div>
    </div>
  );
}
