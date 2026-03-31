import { useState, useRef } from 'react'
import { filesAPI } from '../services/api'
import { Overlay } from './KeyModal'

export default function DownloadModal({ file, onClose }) {
  const [keyHex,  setKeyHex]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const fileRef = useRef()

  const loadKeyFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const match = text.match(/YOUR KEY[^:]*:\n([0-9a-f]{64})/i)
      if (match) setKeyHex(match[1].trim())
      else {
        const hexLine = text.split('\n').find(l => /^[0-9a-f]{64}$/i.test(l.trim()))
        if (hexLine) setKeyHex(hexLine.trim())
        else setError('Could not find a valid key in that file')
      }
    }
    reader.readAsText(f)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (file.is_shared) {
        await filesAPI.downloadShare(file.share_id, keyHex.trim(), file.filename)
      } else {
        await filesAPI.download(file.id, keyHex.trim(), file.filename)
      }
      onClose()
    } catch(err) {
      setError(err.response?.data?.detail || 'Decryption failed — check your key')
    } finally { setLoading(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ fontSize:17, fontWeight:600, marginBottom:4 }}>Decrypt & download</h2>
      <p style={{ fontSize:13, color:'var(--text2)', marginBottom:6 }}>{file.filename}</p>
      {file.key_hint && (
        <p style={{ fontSize:12, color:'var(--text3)', marginBottom:20 }}>
          Key hint: <span style={{ color:'var(--amber2)', fontFamily:'monospace' }}>{file.share_key_hint || file.key_hint}…</span>
        </p>
      )}

      <div style={{
        background:'var(--pbg)', border:'1px solid var(--purple)',
        borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'var(--purple2)'
      }}>
        This file is encrypted with a unique BB84 QKD key. Only the correct key decrypts it.
      </div>

      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={{ display:'block', fontSize:12, color:'var(--text2)', marginBottom:6 }}>
            Paste your key (64-char hex)
          </label>
          <textarea
            value={keyHex}
            onChange={e => setKeyHex(e.target.value)}
            placeholder="64-character hex key..."
            rows={3}
            style={{
              fontFamily:'monospace', fontSize:13, resize:'vertical',
              background:'var(--bg3)', border:'1px solid var(--border)',
              color:'var(--green2)', borderRadius:8, padding:'10px 14px', width:'100%', outline:'none'
            }}
          />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
          <span style={{ fontSize:12, color:'var(--text3)' }}>or</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        </div>

        <button type="button" onClick={() => fileRef.current?.click()} style={{
          padding:'10px', background:'var(--bg3)', color:'var(--text2)',
          border:'1px solid var(--border)', borderRadius:8, fontSize:13
        }}>
          Upload .key file
        </button>
        <input ref={fileRef} type="file" accept=".key,.txt" style={{ display:'none' }} onChange={loadKeyFile}/>

        {error && (
          <p style={{ color:'var(--red2)', fontSize:13, background:'var(--rbg)', padding:'8px 12px', borderRadius:8 }}>
            {error}
          </p>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button type="button" onClick={onClose} style={{
            flex:1, padding:'10px', background:'var(--bg4)',
            color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:13
          }}>Cancel</button>
          <button type="submit" disabled={!keyHex.trim() || loading} style={{
            flex:2, padding:'10px', background:'var(--tbg)',
            color:'var(--teal2)', border:'1px solid var(--teal)', borderRadius:8, fontSize:13
          }}>
            {loading ? 'Decrypting…' : '↓ Decrypt & download'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}
