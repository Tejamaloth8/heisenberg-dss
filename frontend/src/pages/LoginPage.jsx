import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../App'
import AuthLayout from '../components/AuthLayout'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form,    setForm]    = useState({ email:'', password:'' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await authAPI.login(form.email, form.password)
      login(res.data.access_token)
      navigate('/')
    } catch(err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Heisenberg Group Digital Signature System">
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={L}>Email</label>
          <input type="email" placeholder="you@example.com" value={form.email}
            onChange={e => setForm(f => ({...f, email:e.target.value}))} required/>
        </div>
        <div>
          <label style={L}>Password</label>
          <input type="password" placeholder="••••••••" value={form.password}
            onChange={e => setForm(f => ({...f, password:e.target.value}))} required/>
        </div>
        {error && <p style={E}>{error}</p>}
        <button type="submit" disabled={loading} style={B}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--text2)' }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </AuthLayout>
  )
}
const L = { display:'block', fontSize:12, color:'var(--text2)', marginBottom:6 }
const E = { color:'var(--red2)', fontSize:13, background:'var(--rbg)', padding:'8px 12px', borderRadius:8 }
const B = { background:'var(--purple)', color:'#fff', padding:11, width:'100%', fontSize:14 }
