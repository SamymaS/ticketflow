import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEvents } from '../api'

function getDateParts(iso) {
  const d = new Date(iso)
  return {
    day:   d.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase().replace('.', ''),
    full:  d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }
}

function centsToEuros(cents) {
  return (Number(cents) / 100).toFixed(2)
}

function AvailabilityBar({ available, total }) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0
  const color = pct > 50 ? 'var(--color-success)' : pct > 20 ? 'var(--color-warning)' : 'var(--color-error)'
  return (
    <div className="avail-bar-wrap" title={`${available} / ${total} places disponibles`}>
      <div className="avail-bar-track">
        <div className="avail-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="avail-label" style={{ color }}>
        {available > 0 ? `${available} place${available > 1 ? 's' : ''}` : 'Complet'}
      </span>
    </div>
  )
}

function FeaturedCard({ ev }) {
  const date = getDateParts(ev.starts_at)
  return (
    <Link to={`/events/${ev.id}`} className="event-featured">
      {ev.image_url
        ? <img src={ev.image_url} alt={ev.title} className="event-featured-img" />
        : <div className="event-featured-bg" />
      }
      <div className="event-featured-overlay" />
      <div className="event-featured-content">
        <span className="event-tag">À la une</span>
        <h2 className="event-featured-title">{ev.title}</h2>
        <div className="event-featured-meta">
          <span>📍 {ev.venue}</span>
          <span>📅 {date.full}</span>
        </div>
        <div className="event-featured-footer">
          <div>
            {ev.min_price_cents && (
              <p className="event-featured-price">Dès {centsToEuros(ev.min_price_cents)} €</p>
            )}
            {ev.total_seats > 0 && (
              <AvailabilityBar available={Number(ev.available_seats)} total={Number(ev.total_seats)} />
            )}
          </div>
          <span className="btn btn-primary">Voir les places →</span>
        </div>
      </div>
    </Link>
  )
}

function EventCard({ ev }) {
  const date = getDateParts(ev.starts_at)
  return (
    <Link to={`/events/${ev.id}`} className="event-card">
      <div className="event-img-wrapper">
        {ev.image_url
          ? <img src={ev.image_url} alt={ev.title} className="event-img" />
          : <div className="event-no-image">🎵</div>
        }
        <div className="event-img-overlay" />
        <div className="event-date-chip">
          <span className="date-chip-day">{date.day}</span>
          <span className="date-chip-month">{date.month}</span>
        </div>
      </div>
      <div className="event-body">
        <h2 className="event-title">{ev.title}</h2>
        <p className="event-venue">📍 {ev.venue}</p>
        {ev.description && <p className="event-desc">{ev.description}</p>}
        <div className="event-card-footer">
          {ev.min_price_cents && (
            <span className="event-price-tag">
              Dès <strong>{centsToEuros(ev.min_price_cents)} €</strong>
            </span>
          )}
          {ev.total_seats > 0 && (
            <AvailabilityBar available={Number(ev.available_seats)} total={Number(ev.total_seats)} />
          )}
        </div>
      </div>
      <span className="event-cta">Voir les places →</span>
    </Link>
  )
}

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getEvents()
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loader">Chargement des événements…</div>
  if (error)   return <div className="page-error">Erreur : {error}</div>

  const [featured, ...rest] = events

  return (
    <div className="page">
      <div className="hero">
        <p className="hero-eyebrow">Billetterie en ligne</p>
        <h1 className="hero-title">Vos prochains<br />événements</h1>
        <p className="hero-sub">Réservez vos places en quelques clics, recevez votre billet PDF et QR code instantanément.</p>
      </div>

      {events.length === 0 ? (
        <p className="empty-msg">Aucun événement disponible pour le moment.</p>
      ) : (
        <>
          {featured && <FeaturedCard ev={featured} />}

          {rest.length > 0 && (
            <>
              <div className="events-section-header">
                <h2 className="events-section-title">Tous les événements</h2>
                <span className="events-count">{rest.length} événement{rest.length > 1 ? 's' : ''}</span>
              </div>
              <div className="events-grid">
                {rest.map((ev) => <EventCard key={ev.id} ev={ev} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
