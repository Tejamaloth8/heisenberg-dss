import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../App'
import AuthLayout from '../components/AuthLayout'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form,    setForm]    = useState({ email:'', password:'' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [qkdInfo, setQkdInfo] = useState(null)

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await authAPI.register(form.email, form.password)
      setQkdInfo(res.data.qkd_info)
      setTimeout(async () => {
        const lr = await authAPI.login(form.email, form.password)
        login(lr.data.access_token)
        navigate('/')
      }, 2200)
    } catch(err) {
      setError(err.response?.data?.detail || 'Registration failed')
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="Generate your Heisenberg quantum identity">
      {qkdInfo ? (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>⚛</div>
          <p style={{ color:'var(--green2)', fontWeight:600, fontSize:15, marginBottom:12 }}>
            Quantum identity created!
          </p>
          <div style={{
            background:'var(--tbg)', border:'1px solid var(--teal)',
            borderRadius:10, padding:'12px 16px', textAlign:'left', marginBottom:12
          }}>
            <p style={{ fontSize:12, color:'var(--teal2)', marginBottom:6, fontWeight:500 }}>
              BB84 QKD Exchange
            </p>
            <p style={{ fontSize:13, color:'var(--text2)' }}>
              QBER: <strong style={{ color:'var(--text)' }}>{(qkdInfo.qber*100).toFixed(2)}%</strong>
            </p>
            <p style={{ fontSize:13, color:'var(--text2)', marginTop:4 }}>
              Channel: <strong style={{ color:'var(--green2)' }}>Secure — no eavesdrop detected</strong>
            </p>
          </div>
          <div style={{
            background:'var(--pbg)', border:'1px solid var(--purple)',
            borderRadius:10, padding:'10px 14px', textAlign:'left'
          }}>
            <p style={{ fontSize:12, color:'var(--purple2)', marginBottom:4, fontWeight:500 }}>
              Heisenberg Group Signing Key
            </p>
            <p style={{ fontSize:12, color:'var(--text2)' }}>
              Schnorr keypair generated over H(Z/PZ)
            </p>
          </div>
          <p style={{ fontSize:12, color:'var(--text3)', marginTop:14 }}>Redirecting to dashboard…</p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={L}>Email</label>
            <input type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({...f, email:e.target.value}))} required/>
          </div>
          <div>
            <label style={L}>Password</label>
            <input type="password" placeholder="Min. 6 characters" value={form.password}
              onChange={e => setForm(f => ({...f, password:e.target.value}))} required minLength={6}/>
          </div>
          {error && <p style={E}>{error}</p>}
          <button type="submit" disabled={loading} style={B}>
            {loading ? 'Running BB84 QKD…' : 'Create account + generate keys'}
          </button>
        </form>
      )}
      <p style={{ textAlign:'center', marginTop:16, fontSize:13, color:'var(--text2)' }}>
        Have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
const L = { display:'block', fontSize:12, color:'var(--text2)', marginBottom:6 }
const E = { color:'var(--red2)', fontSize:13, background:'var(--rbg)', padding:'8px 12px', borderRadius:8 }
const B = { background:'var(--purple)', color:'#fff', padding:11, width:'100%', fontSize:14 }
