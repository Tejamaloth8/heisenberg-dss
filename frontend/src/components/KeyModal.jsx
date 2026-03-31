import { useState } from 'react'

export default function KeyModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(data.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const content = [
      `Heisenberg Group Digital Signature System`,
      `==========================================`,
      `File    : ${data.filename}`,
      `Key hint: ${data.key_hint}`,
      `QBER    : ${(data.qber * 100).toFixed(2)}%`,
      ``,
      `YOUR KEY (keep this safe - shown only once):`,
      `${data.key}`,
      ``,
      `This key is required to decrypt your file.`,
      `The server does NOT store this key.`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `hgdss_key_${data.key_hint}.key`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Overlay onClose={null}>
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🔑</div>
        <h2 style={{ fontSize:17, fontWeight:600, marginBottom:4 }}>{data.title || 'Your encryption key'}</h2>
        <p style={{ fontSize:13, color:'var(--text2)' }}>{data.filename}</p>
      </div>

      <div style={{
        background:'var(--rbg)', border:'1px solid var(--red)',
        borderRadius:10, padding:'12px 14px', marginBottom:16
      }}>
        <p style={{ fontSize:12, color:'var(--red2)', fontWeight:600, marginBottom:4 }}>
          ⚠ SHOWN ONCE — save this key now
        </p>
        <p style={{ fontSize:12, color:'var(--text2)' }}>
          The server does not store this key. If you lose it, the file cannot be decrypted.
        </p>
      </div>

      <div style={{
        background:'var(--bg3)', border:'1px solid var(--border2)',
        borderRadius:10, padding:'14px', marginBottom:14
      }}>
        <p style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>Encryption key (hex)</p>
        <p style={{
          fontFamily:'monospace', fontSize:13, color:'var(--green2)',
          wordBreak:'break-all', lineHeight:1.6
        }}>{data.key}</p>
        <div style={{ display:'flex', gap:6, marginTop:10 }}>
          <p style={{ fontSize:11, color:'var(--text3)', flex:1 }}>
            Key hint: <span style={{ color:'var(--text2)' }}>{data.key_hint}…</span>
          </p>
          <p style={{ fontSize:11, color:'var(--text3)' }}>
            QBER: <span style={{ color:'var(--teal2)' }}>{(data.qber*100).toFixed(2)}%</span>
          </p>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <button onClick={copy} style={{
          flex:1, padding:'10px', borderRadius:8,
          background: copied ? 'var(--gbg)' : 'var(--pbg)',
          color: copied ? 'var(--green2)' : 'var(--purple2)',
          border:`1px solid ${copied ? 'var(--green)' : 'var(--purple)'}`,
          fontSize:13
        }}>
          {copied ? '✓ Copied' : 'Copy key'}
        </button>
        <button onClick={download} style={{
          flex:1, padding:'10px', borderRadius:8,
          background:'var(--tbg)', color:'var(--teal2)',
          border:'1px solid var(--teal)', fontSize:13
        }}>
          ↓ Download .key file
        </button>
      </div>

      <button onClick={onClose} style={{
        width:'100%', padding:'10px', background:'var(--bg4)',
        color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:13
      }}>
        I've saved my key — close
      </button>
    </Overlay>
  )
}

export function Overlay({ onClose, children }) {
  return (
    <div onClick={onClose || undefined} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.75)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:200, padding:20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--bg2)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', padding:24,
        width:'100%', maxWidth:460, boxShadow:'var(--shadow)'
      }}>
        {children}
      </div>
    </div>
  )
}
