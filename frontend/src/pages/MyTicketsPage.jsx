import { useEffect, useState } from 'react'
import { getMyReservations } from '../api'

const STATUS_LABEL = {
  paid: 'Payé',
  pending: 'En attente',
  cancelled: 'Annulé',
}

function centsToEuros(cents) {
  return (cents / 100).toFixed(2)
}

export default function MyTicketsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyReservations()
      .then((data) => setReservations(data.reservations))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loader">Chargement de vos billets…</div>
  if (error) return <div className="page-error">Erreur : {error}</div>

  return (
    <div className="page">
      <h1 className="page-title">Mes billets</h1>
      {reservations.length === 0 ? (
        <p className="empty-msg">Vous n'avez aucune réservation pour l'instant.</p>
      ) : (
        <div className="reservations-list">
          {reservations.map((res) => (
            <div key={res.id} className="reservation-card">
              <div className="reservation-header">
                <h2 className="reservation-event">{res.event_title}</h2>
                <span className={`status-badge status-${res.status}`}>
                  {STATUS_LABEL[res.status] || res.status}
                </span>
              </div>
              <p className="reservation-total">
                Total : <strong>{centsToEuros(res.total_cents)} €</strong>
              </p>
              {res.tickets && res.tickets.length > 0 && (
                <div className="tickets-list">
                  <h3>Billets</h3>
                  <ul>
                    {res.tickets.map((ticket) => (
                      <li key={ticket.seatId} className="ticket-item">
                        <span>Siège #{ticket.seatId}</span>
                        {ticket.pdfUrl ? (
                          <a
                            href={ticket.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-small btn-secondary"
                          >
                            Télécharger PDF
                          </a>
                        ) : (
                          <span className="ticket-pending">PDF en cours de génération…</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
