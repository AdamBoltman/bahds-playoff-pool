import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { brightcoveEmbedUrl } from '../lib/nhl.js'

export default function VideoModal({ videoId, title, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={s.card} onClick={e => e.stopPropagation()}>
        <div style={s.frame}>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
          <iframe
            src={brightcoveEmbedUrl(videoId)}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            style={s.iframe}
            title={title || 'Game video'}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}

const s = {
  card: { maxWidth: 720, background: '#000', border: 'none' },
  closeBtn: {
    position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.25)', color: 'white',
    fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  frame: { position: 'relative', paddingTop: '56.25%' },
  iframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', borderRadius: 18 },
}
