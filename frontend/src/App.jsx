import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, createContext, useContext } from 'react'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'

export const AuthContext = createContext(null)
export const useAuth     = () => useContext(AuthContext)

function Private({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  const login = (tok) => { localStorage.setItem('token', tok); setToken(tok) }
  const logout = ()   => { localStorage.removeItem('token'); setToken(null)  }

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*"        element={<Private><DashboardPage /></Private>} />
      </Routes>
    </AuthContext.Provider>
  )
}
