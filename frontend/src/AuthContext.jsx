import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('tf_user')
    return raw ? JSON.parse(raw) : null
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
