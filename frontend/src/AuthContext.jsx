import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw   = localStorage.getItem('tf_user')
    const token = localStorage.getItem('tf_token')
    // Les deux doivent être présents — si le token manque, on part d'un état vierge
    if (!raw || !token) {
      localStorage.removeItem('tf_user')
      localStorage.removeItem('tf_token')
      return null
    }
    return JSON.parse(raw)
  })

  function saveAuth(userData, token) {
    localStorage.setItem('tf_token', token)
    localStorage.setItem('tf_user', JSON.stringify(userData))
    setUser(userData)
  }

  function clearAuth() {
    localStorage.removeItem('tf_token')
    localStorage.removeItem('tf_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, saveAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
