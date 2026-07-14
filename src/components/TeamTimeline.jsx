import { useEffect, useRef } from 'react'

// Uses X's official embedded-timeline widget (no API key required) —
// platform.twitter.com/widgets.js finds the anchor below and replaces it with an iframe.
export default function TeamTimeline({ handle }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!handle) return

    function render() {
      window.twttr?.widgets?.load(containerRef.current)
    }

    if (window.twttr?.widgets) {
      render()
    } else {
      let script = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://platform.twitter.com/widgets.js'
        script.async = true
        document.body.appendChild(script)
      }
      script.addEventListener('load', render)
      return () => script.removeEventListener('load', render)
    }
  }, [handle])

  if (!handle) return null

  return (
    <div ref={containerRef} style={{ borderRadius: 12, overflow: 'hidden', minHeight: 80 }}>
      {/* X's widget replaces this anchor with an iframe when it loads successfully.
          Their embed backend rate-limits sometimes, so this anchor is styled to look
          intentional (not broken) if that happens — it's a real, working fallback link. */}
      <a
        className="twitter-timeline hover-lift"
        data-theme="dark"
        data-height="600"
        data-chrome="noheader nofooter noborders transparent"
        href={`https://twitter.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        style={s.fallback}
      >
        <span style={s.fallbackIcon}>𝕏</span>
        <span>
          <div style={s.fallbackTitle}>View @{handle} on X</div>
          <div style={s.fallbackSub}>Latest posts open in a new tab</div>
        </span>
      </a>
    </div>
  )
}

const s = {
  fallback: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    textDecoration: 'none', color: 'inherit',
  },
  fallbackIcon: {
    width: 34, height: 34, borderRadius: '50%', background: 'var(--surface2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    fontSize: 15, fontWeight: 700, color: 'var(--text)',
  },
  fallbackTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  fallbackSub: { fontSize: 12, color: 'var(--dim)', marginTop: 2 },
}
