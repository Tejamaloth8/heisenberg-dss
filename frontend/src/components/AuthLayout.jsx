export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', padding:24, background:'var(--bg)'
    }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:56, height:56, borderRadius:16,
            background:'var(--pbg)', border:'1px solid var(--purple)',
            fontSize:26, marginBottom:16
          }}>⚛</div>
          <h1 style={{ fontSize:20, fontWeight:600, marginBottom:6 }}>{title}</h1>
          <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{subtitle}</p>
        </div>
        <div style={{
          background:'var(--bg2)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-lg)', padding:28, boxShadow:'var(--shadow)'
        }}>
          {children}
        </div>
        <div style={{
          textAlign:'center', marginTop:20, display:'flex',
          alignItems:'center', justifyContent:'center', gap:8
        }}>
          <span style={{
            background:'var(--pbg)', color:'var(--purple2)', border:'1px solid var(--purple)',
            borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:500
          }}>BB84 QKD</span>
          <span style={{ fontSize:11, color:'var(--text3)' }}>+</span>
          <span style={{
            background:'var(--tbg)', color:'var(--teal2)', border:'1px solid var(--teal)',
            borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:500
          }}>H-Group Schnorr</span>
        </div>
      </div>
    </div>
  )
}
