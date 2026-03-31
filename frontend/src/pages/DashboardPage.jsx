import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesAPI, authAPI } from '../services/api'
import { useAuth } from '../App'
import KeyModal     from '../components/KeyModal'
import VerifyModal  from '../components/VerifyModal'
import ShareModal   from '../components/ShareModal'
import DownloadModal from '../components/DownloadModal'

export default function DashboardPage() {
  const { logout }   = useAuth()
  const navigate     = useNavigate()
  const [docs,       setDocs]       = useState({ owned:[], shared:[] })
  const [user,       setUser]       = useState(null)
  const [tab,        setTab]        = useState('owned')
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [keyData,    setKeyData]    = useState(null)
  const [verifyFile, setVerifyFile] = useState(null)
  const [shareFile,  setShareFile]  = useState(null)
  const [dlFile,     setDlFile]     = useState(null)
  const [toast,      setToast]      = useState(null)
  const fileRef = useRef()

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = async () => {
    try {
      const [dr, mr] = await Promise.all([filesAPI.list(), authAPI.me()])
      setDocs(dr.data); setUser(mr.data)
    } catch { logout(); navigate('/login') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await filesAPI.upload(fd)
      setKeyData({
        key:      res.data.file_key,
        key_hint: res.data.key_hint,
        qber:     res.data.qber,
        filename: res.data.filename,
        title:    'Your file encryption key',
      })
      load()
    } catch(err) {
      showToast(err.response?.data?.detail || 'Upload failed', 'error')
    } finally { setUploading(false); e.target.value = '' }
  }

  const allDocs = tab === 'owned' ? docs.owned : docs.shared

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <p style={{ color:'var(--text2)' }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ maxWidth:920, margin:'0 auto', padding:'24px 20px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:42, height:42, borderRadius:12,
            background:'var(--pbg)', border:'1px solid var(--purple)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:22
          }}>⚛</div>
          <div>
            <h1 style={{ fontSize:16, fontWeight:600, lineHeight:1.2 }}>
              Heisenberg Group Digital Signature System
            </h1>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{user?.email}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{
            fontSize:11, padding:'3px 10px', borderRadius:20,
            background:'var(--tbg)', color:'var(--teal2)', border:'1px solid var(--teal)'
          }}>zero-knowledge</span>
          <button onClick={() => { logout(); navigate('/login') }} style={{
            background:'var(--bg3)', color:'var(--text2)',
            border:'1px solid var(--border)', padding:'7px 14px', fontSize:13
          }}>Sign out</button>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border:`2px dashed ${uploading ? 'var(--purple)' : 'var(--border2)'}`,
          borderRadius:'var(--radius-lg)', padding:'28px', textAlign:'center',
          cursor: uploading ? 'default' : 'pointer',
          background:'var(--bg2)', marginBottom:24, transition:'border-color .2s',
        }}
        onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor='var(--purple2)' }}
        onMouseLeave={e => { if (!uploading) e.currentTarget.style.borderColor='var(--border2)' }}
      >
        <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleUpload}/>
        <div style={{ fontSize:28, marginBottom:8 }}>📁</div>
        <p style={{ fontWeight:500, marginBottom:4, fontSize:15 }}>
          {uploading ? 'Running BB84 QKD + encrypting…' : 'Click to upload a file'}
        </p>
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:10 }}>
          <Badge color="purple" text="BB84 QKD key generation"/>
          <Badge color="teal"   text="AES-256-GCM encryption"/>
          <Badge color="coral"  text="H-group signature"/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        {['owned','shared'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'7px 18px', borderRadius:8, fontSize:13, fontWeight:500,
            background: tab===t ? 'var(--purple)' : 'var(--bg2)',
            color:       tab===t ? '#fff' : 'var(--text2)',
            border:`1px solid ${tab===t ? 'var(--purple)' : 'var(--border)'}`,
          }}>
            {t === 'owned'
              ? `My files (${docs.owned.length})`
              : `Shared with me (${docs.shared.length})`}
          </button>
        ))}
      </div>

      {/* File list */}
      {allDocs.length === 0 ? (
        <Empty tab={tab}/>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {allDocs.map(doc => (
            <FileCard
              key={doc.id} doc={doc} tab={tab}
              onDownload={() => setDlFile(doc)}
              onVerify={() => setVerifyFile(doc)}
              onShare={() => setShareFile(doc)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {keyData    && <KeyModal      data={keyData}    onClose={() => setKeyData(null)}/>}
      {verifyFile && <VerifyModal   file={verifyFile} onClose={() => setVerifyFile(null)}/>}
      {shareFile  && <ShareModal    file={shareFile}  onClose={() => setShareFile(null)} onShared={() => { load(); showToast('File shared — give the key to the recipient') }}/>}
      {dlFile     && <DownloadModal file={dlFile}     onClose={() => setDlFile(null)}/>}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, right:24,
          background: toast.type==='error' ? 'var(--rbg)' : 'var(--gbg)',
          border:`1px solid ${toast.type==='error' ? 'var(--red)' : 'var(--green)'}`,
          color: toast.type==='error' ? 'var(--red2)' : 'var(--green2)',
          padding:'12px 18px', borderRadius:10, fontSize:14, maxWidth:360,
          boxShadow:'var(--shadow)', zIndex:999
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function FileCard({ doc, tab, onDownload, onVerify, onShare }) {
  return (
    <div style={{
      background:'var(--bg2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', padding:'14px 18px',
      display:'flex', alignItems:'center', gap:14,
      transition:'border-color .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{
        width:40, height:40, borderRadius:10, flexShrink:0,
        background:'var(--bg3)', border:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18
      }}>{fileIcon(doc.filename)}</div>

      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:14 }}>
          {doc.filename}
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'monospace' }}>
            key: {doc.share_key_hint || doc.key_hint}…
          </span>
          {tab === 'shared' && (
            <span style={{ fontSize:11, color:'var(--text3)' }}>from {doc.owner}</span>
          )}
          {doc.signed && (
            <span style={{
              fontSize:11, background:'var(--gbg)', color:'var(--green2)',
              border:'1px solid var(--green)', borderRadius:6, padding:'1px 7px'
            }}>✓ H-signed</span>
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <Btn onClick={onDownload} color="teal"   label="↓ Decrypt"/>
        {!tab || tab==='owned' ? (
          <>
            {!doc.is_shared && <Btn onClick={onShare} color="amber" label="⇗ Share"/>}
            {doc.signed && <Btn onClick={onVerify} color="green" label="✓ Verify"/>}
          </>
        ) : (
          doc.signed && <Btn onClick={onVerify} color="green" label="✓ Verify"/>
        )}
      </div>
    </div>
  )
}

function Btn({ onClick, color, label, disabled }) {
  const c = {
    purple: { bg:'var(--pbg)', text:'var(--purple2)', border:'var(--purple)' },
    teal:   { bg:'var(--tbg)', text:'var(--teal2)',   border:'var(--teal)'   },
    amber:  { bg:'var(--abg)', text:'var(--amber2)',  border:'var(--amber)'  },
    green:  { bg:'var(--gbg)', text:'var(--green2)',  border:'var(--green)'  },
  }[color]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:c.bg, color:c.text, border:`1px solid ${c.border}`,
      padding:'6px 12px', fontSize:12, fontWeight:500, borderRadius:8
    }}>{label}</button>
  )
}

function Badge({ color, text }) {
  const c = {
    purple: { bg:'var(--pbg)', text:'var(--purple2)', border:'var(--purple)' },
    teal:   { bg:'var(--tbg)', text:'var(--teal2)',   border:'var(--teal)'   },
    coral:  { bg:'#1c0d08',    text:'#f0997b',        border:'#993c1d'       },
  }[color]
  return (
    <span style={{
      fontSize:11, padding:'2px 10px', borderRadius:20,
      background:c.bg, color:c.text, border:`1px solid ${c.border}`
    }}>{text}</span>
  )
}

function Empty({ tab }) {
  return (
    <div style={{
      textAlign:'center', padding:'48px 24px', color:'var(--text3)',
      background:'var(--bg2)', borderRadius:'var(--radius-lg)',
      border:'1px solid var(--border)'
    }}>
      <p style={{ fontSize:28, marginBottom:8 }}>📂</p>
      <p>{tab==='owned' ? 'No files uploaded yet. Upload one above.' : 'No files shared with you yet.'}</p>
    </div>
  )
}

function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼'
  if (ext === 'pdf')                                    return '📄'
  if (['doc','docx'].includes(ext))                     return '📝'
  if (['zip','tar','gz'].includes(ext))                 return '🗜'
  return '📎'
}
