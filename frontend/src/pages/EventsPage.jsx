import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEvents } from '../api'

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
  if (error) return <div className="page-error">Erreur : {error}</div>

  return (
    <div className="page">
      <h1 className="page-title">Événements</h1>
      {events.length === 0 ? (
        <p className="empty-msg">Aucun événement disponible.</p>
      ) : (
        <div className="events-grid">
          {events.map((ev) => (
            <Link key={ev.id} to={`/events/${ev.id}`} className="event-card">
              {ev.image_url && (
                <img
                  src={ev.image_url}
                  alt={ev.title}
                  className="event-img"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              )}
              <div className="event-body">
                <h2 className="event-title">{ev.title}</h2>
                <p className="event-venue">{ev.venue}</p>
                <p className="event-date">{formatDate(ev.starts_at)}</p>
                {ev.description && (
                  <p className="event-desc">{ev.description}</p>
                )}
              </div>
              <span className="event-cta">Voir les places →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
