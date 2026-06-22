import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Navbar() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link to="/events" className="navbar-brand">
        🎟 TicketFlow
      </Link>
      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/events" className="nav-link">Événements</Link>
            <Link to="/tickets" className="nav-link">Mes billets</Link>
            <span className="nav-user">{user.name || user.email}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Connexion</Link>
            <Link to="/register" className="btn btn-primary btn-small">S'inscrire</Link>
          </>
        )}
      </div>
    </nav>
  )
}
