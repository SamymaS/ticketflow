import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { confirmReservation } from '../api'
import CountdownTimer from '../components/CountdownTimer'

function centsToEuros(cents) {
  return (cents / 100).toFixed(2)
}

export default function CheckoutPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | success | error | degraded | expired

  // Redirect if arrived without state (e.g. direct navigation)
  useEffect(() => {
    if (!state) navigate('/events', { replace: true })
  }, [state, navigate])

  if (!state) return null

  const { eventId, eventTitle, seatIds, heldSeats, expiresInSeconds, totalCents } = state

  function handleExpire() {
    setStatus('expired')
  }

  async function handleConfirm() {
    setStatus('loading')
    try {
      await confirmReservation(eventId, seatIds)
      setStatus('success')
      setTimeout(() => navigate('/tickets'), 1500)
    } catch (err) {
      if (err.status === 503) {
        setStatus('degraded')
      } else if (err.status === 402) {
        setStatus('error')
      } else {
        setStatus('error')
      }
    }
  }

  if (status === 'expired') {
    return (
      <div className="page centered">
        <div className="status-card status-warning">
          <h2>Temps écoulé</h2>
          <p>Votre réservation temporaire a expiré. Veuillez sélectionner de nouveau vos places.</p>
          <button className="btn btn-primary" onClick={() => navigate(`/events/${eventId}`)}>
            Retour à l'événement
          </button>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="page centered">
        <div className="status-card status-success">
          <h2>Paiement accepté !</h2>
          <p>Redirection vers vos billets…</p>
        </div>
      </div>
    )
  }

  if (status === 'degraded') {
    return (
      <div className="page centered">
        <div className="status-card status-warning">
          <h2>Paiement indisponible</h2>
          <p>Le service de paiement est temporairement indisponible. Veuillez réessayer dans quelques instants.</p>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleConfirm}>
              Réessayer
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/events')}>
              Retour aux événements
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="page centered">
        <div className="status-card status-error">
          <h2>Paiement refusé</h2>
          <p>Votre paiement n'a pas pu être traité. Veuillez vérifier vos informations et réessayer.</p>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleConfirm}>
              Réessayer
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/events')}>
              Retour aux événements
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Finaliser la commande</h1>

      <div className="checkout-card">
        <CountdownTimer seconds={expiresInSeconds} onExpire={handleExpire} />

        <h2 className="checkout-event">{eventTitle}</h2>

        <table className="seat-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Rangée</th>
              <th>Siège</th>
              <th>Prix</th>
            </tr>
          </thead>
          <tbody>
            {heldSeats.map((seat) => (
              <tr key={seat.id}>
                <td>{seat.section}</td>
                <td>{seat.row_label}</td>
                <td>{seat.number}</td>
                <td>{centsToEuros(seat.price_cents)} €</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><strong>Total</strong></td>
              <td><strong>{centsToEuros(totalCents)} €</strong></td>
            </tr>
          </tfoot>
        </table>

        <button
          className="btn btn-primary btn-large"
          onClick={handleConfirm}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Traitement en cours…' : `Payer ${centsToEuros(totalCents)} €`}
        </button>
      </div>
    </div>
  )
}
