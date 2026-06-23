import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getMyReservations } from '../api'

const STATUS_LABEL = {
  paid: 'Payé',
  pending: 'En attente',
  cancelled: 'Annulé',
}

function centsToEuros(cents) {
  return (cents / 100).toFixed(2)
}

function seatLabel(ticket) {
  if (ticket.section && ticket.rowLabel && ticket.number != null) {
    return `${ticket.section} — Rangée ${ticket.rowLabel}, Siège ${ticket.number}`
  }
  return `Siège #${ticket.seatId}`
}

function QrModal({ qrCode, label, onClose }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(qrCode, { width: 280, margin: 2 })
      .then(setDataUrl)
      .catch(() => {})
  }, [qrCode])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <h2 className="modal-title">QR Code</h2>
        <p className="modal-seat">{label}</p>
        {dataUrl
          ? <img src={dataUrl} alt="QR Code billet" className="modal-qr" />
          : <p className="ticket-pending">Génération…</p>
        }
        <p className="modal-hint">Présentez ce QR code à l'entrée</p>
      </div>
    </div>
  )
}

export default function MyTicketsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeQr, setActiveQr] = useState(null)

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
                        <span className="ticket-seat">{seatLabel(ticket)}</span>
                        {ticket.pdfUrl ? (
                          <div className="ticket-actions">
                            <a
                              href={ticket.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-small btn-secondary"
                            >
                              Télécharger PDF
                            </a>
                            <button
                              className="btn btn-small btn-primary"
                              onClick={() => setActiveQr({ qrCode: ticket.qrCode, label: seatLabel(ticket) })}
                            >
                              Voir QR code
                            </button>
                          </div>
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

      {activeQr && (
        <QrModal
          qrCode={activeQr.qrCode}
          label={activeQr.label}
          onClose={() => setActiveQr(null)}
        />
      )}
    </div>
  )
}
