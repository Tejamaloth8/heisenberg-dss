import { useState } from 'react'
import { filesAPI } from '../services/api'
import { Overlay } from './KeyModal'
import KeyModal from './KeyModal'

export default function ShareModal({ file, onClose, onShared }) {
  const [step,         setStep]        = useState('form')
  const [email,        setEmail]       = useState('')
  const [ownerKey,     setOwnerKey]    = useState('')
  const [loading,      setLoading]     = useState(false)
  const [error,        setError]       = useState('')
  const [shareKeyData, setShareKeyData] = useState(null)

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await filesAPI.share(file.id, email, ownerKey.trim())
      setShareKeyData({
        key:      res.data.share_key,
        key_hint: res.data.share_key_hint,
        qber:     res.data.qber,
        filename: file.filename,
        title:    `Share key for ${email}`,
      })
      setStep('key')
      onShared()
    } catch(err) {
      setError(err.response?.data?.detail || 'Share failed')
    } finally { setLoading(false) }
  }

  if (step === 'key') {
    return <KeyModal data={shareKeyData} onClose={onClose}/>
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ fontSize:17, fontWeight:600, marginBottom:4 }}>Share file</h2>
      <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>{file.filename}</p>

      <div style={{
        background:'var(--abg)', border:'1px solid var(--amber)',
        borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'var(--amber2)'
      }}>
        A new BB84 QKD key will be generated for the recipient. You must provide your own
        file key to re-encrypt it.
      </div>

      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={L}>Recipient email</label>
          <input type="email" placeholder="colleague@example.com"
            value={email} onChange={e => setEmail(e.target.value)} required/>
        </div>
        <div>
          <label style={L}>Your file key (to decrypt for re-encryption)</label>
          <textarea
            value={ownerKey} onChange={e => setOwnerKey(e.target.value)}
            placeholder="64-character hex key..." rows={3}
            style={{
              fontFamily:'monospace', fontSize:13, resize:'vertical',
              background:'var(--bg3)', border:'1px solid var(--border)',
              color:'var(--green2)', borderRadius:8, padding:'10px 14px', width:'100%', outline:'none'
            }}
            required
          />
        </div>
        {error && <p style={{ color:'var(--red2)', fontSize:13, background:'var(--rbg)', padding:'8px 12px', borderRadius:8 }}>{error}</p>}
        <div style={{ display:'flex', gap:10 }}>
          <button type="button" onClick={onClose} style={{
            flex:1, padding:'10px', background:'var(--bg4)',
            color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:13
          }}>Cancel</button>
          <button type="submit" disabled={loading} style={{
            flex:2, padding:'10px', background:'var(--abg)',
            color:'var(--amber2)', border:'1px solid var(--amber)', borderRadius:8, fontSize:13
          }}>
            {loading ? 'Generating share key…' : '⇗ Share & generate key'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}
const L = { display:'block', fontSize:12, color:'var(--text2)', marginBottom:6 }
