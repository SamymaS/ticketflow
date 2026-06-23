import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Navbar() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    clearAuth()
    navigate('/login')
    setMenuOpen(false)
  }

  const close = () => setMenuOpen(false)
  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <nav className="navbar">
      <NavLink to="/events" className="navbar-brand" onClick={close}>
        🎟 TicketFlow
      </NavLink>

      <button
        className="navbar-hamburger"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
        {user ? (
          <>
            <NavLink to="/events"  className={linkClass} onClick={close}>Événements</NavLink>
            <NavLink to="/tickets" className={linkClass} onClick={close}>Mes billets</NavLink>
            <span className="nav-user">{user.name || user.email}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>Déconnexion</button>
          </>
        ) : (
          <>
            <NavLink to="/login"    className={linkClass}              onClick={close}>Connexion</NavLink>
            <NavLink to="/register" className="btn btn-primary btn-small" onClick={close}>S'inscrire</NavLink>
          </>
        )}
      </div>
    </nav>
  )
}
