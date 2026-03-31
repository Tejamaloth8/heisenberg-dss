import { useState, useEffect } from 'react'
import { filesAPI } from '../services/api'
import { Overlay } from './KeyModal'

export default function VerifyModal({ file, onClose }) {
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    filesAPI.verify(file.id)
      .then(r => setResult(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Verification failed'))
      .finally(() => setLoading(false))
  }, [file.id])

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ fontSize:17, fontWeight:600, marginBottom:4 }}>Signature verification</h2>
      <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>{file.filename}</p>

      {loading && <p style={{ textAlign:'center', color:'var(--text2)', padding:24 }}>Verifying…</p>}
      {error   && <p style={{ color:'var(--red2)', padding:16, background:'var(--rbg)', borderRadius:8 }}>{error}</p>}

      {result && (
        <>
          <div style={{
            borderRadius:12, padding:'16px', marginBottom:18, textAlign:'center',
            background: result.overall_valid ? 'var(--gbg)' : 'var(--rbg)',
            border:`1px solid ${result.overall_valid ? 'var(--green)' : 'var(--red)'}`,
          }}>
            <p style={{ fontSize:28, marginBottom:6 }}>{result.overall_valid ? '✅' : '❌'}</p>
            <p style={{
              fontWeight:600, fontSize:16,
              color: result.overall_valid ? 'var(--green2)' : 'var(--red2)'
            }}>
              {result.overall_valid ? 'Signature valid — file intact' : 'Signature INVALID'}
            </p>
            {result.tampered && (
              <p style={{ fontSize:13, color:'var(--red2)', marginTop:6 }}>
                File has been tampered with after signing
              </p>
            )}
            <p style={{ fontSize:12, color:'var(--text2)', marginTop:6 }}>
              Signed by <strong style={{ color:'var(--text)' }}>{result.signed_by}</strong>
            </p>
          </div>

          <p style={{ fontSize:11, color:'var(--text3)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.05em' }}>
            Verification layers
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            <Layer label="File hash integrity" desc="SHA-256 of ciphertext matches signed hash" valid={result.hash_intact}/>
            <Layer label="Heisenberg group signature" desc={result.algorithm} valid={result.signature_valid}/>
          </div>

          <div style={{
            background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:10, padding:'10px 14px'
          }}>
            <p style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Signer public key (H-group element)</p>
            <p style={{ fontFamily:'monospace', fontSize:11, color:'var(--text2)', wordBreak:'break-all' }}>
              {result.signer_public_key}
            </p>
            <p style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>
              Signed at: {new Date(result.signed_at).toLocaleString()}
            </p>
          </div>
        </>
      )}

      <button onClick={onClose} style={{
        marginTop:18, width:'100%', padding:'10px',
        background:'var(--bg4)', color:'var(--text2)',
        border:'1px solid var(--border)', borderRadius:8, fontSize:13
      }}>Close</button>
    </Overlay>
  )
}

function Layer({ label, desc, valid }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      background:'var(--bg3)', borderRadius:10, padding:'10px 14px',
      border:`1px solid ${valid ? 'var(--green)' : 'var(--red)'}`,
    }}>
      <span style={{ fontSize:18 }}>{valid ? '✅' : '❌'}</span>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:13, fontWeight:500 }}>{label}</p>
        <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{desc}</p>
      </div>
      <span style={{
        fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500,
        background: valid ? 'var(--gbg)' : 'var(--rbg)',
        color:      valid ? 'var(--green2)' : 'var(--red2)',
        border:`1px solid ${valid ? 'var(--green)' : 'var(--red)'}`,
      }}>{valid ? 'VALID' : 'FAIL'}</span>
    </div>
  )
}
