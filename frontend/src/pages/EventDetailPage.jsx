import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEvent, holdSeats } from '../api'
import SeatMap from '../components/SeatMap'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function centsToEuros(cents) {
  return (cents / 100).toFixed(2)
}

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [seats, setSeats] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [holding, setHolding] = useState(false)
  const [holdError, setHoldError] = useState('')

  useEffect(() => {
    getEvent(id)
      .then((data) => {
        setEvent(data.event)
        setSeats(data.seats)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function toggleSeat(seat) {
    if (seat.status !== 'available') return
    setSelected((prev) =>
      prev.includes(seat.id) ? prev.filter((s) => s !== seat.id) : [...prev, seat.id]
    )
  }

  const selectedSeats = seats.filter((s) => selected.includes(s.id))
  const totalCents = selectedSeats.reduce((sum, s) => sum + s.price_cents, 0)

  async function handleHold() {
    if (selected.length === 0) return
    setHoldError('')
    setHolding(true)
    try {
      const { held, expiresInSeconds } = await holdSeats(id, selected)
      navigate('/checkout', {
        state: {
          eventId: id,
          eventTitle: event.title,
          seatIds: selected,
          heldSeats: held,
          expiresInSeconds,
          totalCents,
        },
      })
    } catch (err) {
      if (err.status === 409) {
        setHoldError('Un ou plusieurs sièges viennent d\'être pris. Veuillez en choisir d\'autres.')
        // refresh seats
        getEvent(id).then((data) => {
          setSeats(data.seats)
          setSelected([])
        })
      } else {
        setHoldError(err.message)
      }
    } finally {
      setHolding(false)
    }
  }

  if (loading) return <div className="page-loader">Chargement de l'événement…</div>
  if (error) return <div className="page-error">Erreur : {error}</div>

  return (
    <div className="page">
      <div className="event-detail-header">
        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.title}
            className="event-detail-img"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        )}
        <div>
          <h1 className="page-title">{event.title}</h1>
          <p className="event-venue">{event.venue}</p>
          <p className="event-date">{formatDate(event.starts_at)}</p>
          {event.description && <p className="event-desc">{event.description}</p>}
        </div>
      </div>

      <div className="seat-legend">
        <span className="legend-item available">Disponible</span>
        <span className="legend-item held">Réservé temporairement</span>
        <span className="legend-item sold">Vendu</span>
        <span className="legend-item selected">Sélectionné</span>
      </div>

      <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} />

      {selected.length > 0 && (
        <div className="selection-summary">
          <p>
            <strong>{selected.length} siège{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}</strong>
            {' — '}Total : <strong>{centsToEuros(totalCents)} €</strong>
          </p>
          {holdError && <p className="error-msg">{holdError}</p>}
          <button
            className="btn btn-primary"
            onClick={handleHold}
            disabled={holding}
          >
            {holding ? 'Réservation en cours…' : 'Réserver ces places'}
          </button>
        </div>
      )}

      {holdError && selected.length === 0 && (
        <p className="error-msg" style={{ textAlign: 'center' }}>{holdError}</p>
      )}
    </div>
  )
}
