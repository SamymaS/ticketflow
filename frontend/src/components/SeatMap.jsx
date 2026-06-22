export default function SeatMap({ seats, selected, onToggle }) {
  // Group seats by section then by row_label
  const sections = seats.reduce((acc, seat) => {
    if (!acc[seat.section]) acc[seat.section] = {}
    if (!acc[seat.section][seat.row_label]) acc[seat.section][seat.row_label] = []
    acc[seat.section][seat.row_label].push(seat)
    return acc
  }, {})

  return (
    <div className="seat-map">
      <div className="stage">SCÈNE</div>
      {Object.entries(sections).map(([section, rows]) => (
        <div key={section} className="section">
          <h3 className="section-label">{section}</h3>
          {Object.entries(rows).map(([rowLabel, rowSeats]) => (
            <div key={rowLabel} className="seat-row">
              <span className="row-label">{rowLabel}</span>
              <div className="seats">
                {rowSeats
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((seat) => {
                    const isSelected = selected.includes(seat.id)
                    const seatClass = isSelected
                      ? 'seat selected'
                      : `seat ${seat.status}`
                    const isClickable = seat.status === 'available' || isSelected

                    return (
                      <button
                        key={seat.id}
                        className={seatClass}
                        title={`${section} - Rangée ${rowLabel} - Siège ${seat.number} — ${(seat.price_cents / 100).toFixed(2)} €`}
                        disabled={!isClickable}
                        onClick={() => onToggle(seat)}
                        aria-label={`Siège ${seat.number} ${isSelected ? '(sélectionné)' : seat.status}`}
                      >
                        {seat.number}
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
