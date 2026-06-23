import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Navbar() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <nav className="navbar">
      <NavLink to="/events" className="navbar-brand">
        🎟 TicketFlow
      </NavLink>
      <div className="navbar-links">
        {user ? (
          <>
            <NavLink to="/events" className={linkClass}>Événements</NavLink>
            <NavLink to="/tickets" className={linkClass}>Mes billets</NavLink>
            <span className="nav-user">{user.name || user.email}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>Connexion</NavLink>
            <NavLink to="/register" className="btn btn-primary btn-small">S'inscrire</NavLink>
          </>
        )}
      </div>
    </nav>
  )
}
