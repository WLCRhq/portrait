import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function isLightColor(hex) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Perceived brightness formula
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export default function Viewer() {
  const { slug } = useParams();
  const [meta, setMeta] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [error, setError] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [overlays, setOverlays] = useState([]);
  const enteredAtRef = useRef(Date.now());
  const slideContainerRef = useRef(null);

  // Fetch metadata and create session
  useEffect(() => {
    axios.get(`/api/view/${slug}/meta`)
      .then((res) => {
        setMeta(res.data);
        setSessionId(res.data.sessionId);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load presentation');
      });
  }, [slug]);

  // Set background color everywhere to match the presentation
  useEffect(() => {
    if (!meta?.bgColor) return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    const prevRoot = root?.style.backgroundColor;

    html.style.backgroundColor = meta.bgColor;
    body.style.backgroundColor = meta.bgColor;
    if (root) root.style.backgroundColor = meta.bgColor;

    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
      if (root) root.style.backgroundColor = prevRoot;
    };
  }, [meta]);

  // Fetch overlays when slide changes
  useEffect(() => {
    if (!meta) return;
    axios.get(`/api/view/${slug}/slide/${currentSlide}/overlays`)
      .then((res) => setOverlays(res.data))
      .catch(() => setOverlays([]));
  }, [slug, currentSlide, meta]);

  // Send slide event for the previous slide
  const sendSlideEvent = useCallback((slideIndex, entered) => {
    if (!sessionId) return;
    const now = Date.now();
    const payload = {
      sessionId,
      slideIndex,
      enteredAt: new Date(entered).toISOString(),
      exitedAt: new Date(now).toISOString(),
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `/api/view/${slug}/event`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );
    } else {
      axios.post(`/api/view/${slug}/event`, payload).catch(() => {});
    }
  }, [sessionId, slug]);

  // Send end session
  const sendEndSession = useCallback(() => {
    if (!sessionId) return;
    const payload = { sessionId };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `/api/view/${slug}/end`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );
    } else {
      axios.post(`/api/view/${slug}/end`, payload).catch(() => {});
    }
  }, [sessionId, slug]);

  // Handle beforeunload — send final event + end session
  useEffect(() => {
    const handleUnload = () => {
      sendSlideEvent(currentSlide, enteredAtRef.current);
      sendEndSession();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [currentSlide, sendSlideEvent, sendEndSession]);

  const goToSlide = (newIndex) => {
    if (!meta || newIndex < 0 || newIndex >= meta.slideCount) return;

    sendSlideEvent(currentSlide, enteredAtRef.current);

    setCurrentSlide(newIndex);
    setImageLoading(true);
    setOverlays([]);
    enteredAtRef.current = Date.now();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlide(currentSlide - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24,
      }}>
        <h2 style={{ color: 'var(--danger)' }}>Unable to load presentation</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      }}>
        <div className="skeleton" style={{ width: '80vw', height: '60vh' }} />
      </div>
    );
  }

  const progress = ((currentSlide + 1) / meta.slideCount) * 100;
  const cacheBust = meta.exportedAt ? `?v=${new Date(meta.exportedAt).getTime()}` : '';
  const bg = meta.bgColor || '#000';
  const light = isLightColor(bg);
  const textColor = light ? '#333' : '#fff';
  const subtleColor = light ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
  const barTrack = light ? 'rgba(0,0,0,0.1)' : '#333';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: bg, color: textColor, userSelect: 'none',
    }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: barTrack, flexShrink: 0 }}>
        <div style={{
          height: '100%', background: 'var(--accent)',
          width: `${progress}%`, transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Slide area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {imageLoading && (
          <div className="skeleton" style={{
            position: 'absolute', width: '80%', height: '80%',
            background: '#222',
          }} />
        )}

        {/* Slide container: thumbnail + GIF overlays */}
        <div
          ref={slideContainerRef}
          style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}
        >
          <img
            src={`/api/view/${slug}/slide/${currentSlide}${cacheBust}`}
            alt={`Slide ${currentSlide + 1}`}
            style={{
              maxWidth: '100vw', maxHeight: 'calc(100vh - 40px)', objectFit: 'contain',
              display: 'block',
              opacity: imageLoading ? 0 : 1, transition: 'opacity 0.2s',
            }}
            onLoad={() => setImageLoading(false)}
            draggable={false}
          />

          {/* GIF overlays positioned on top of the slide, with crop applied */}
          {!imageLoading && overlays.map((overlay) => {
            const hasCrop = overlay.cropTop || overlay.cropBottom || overlay.cropLeft || overlay.cropRight;

            if (!hasCrop) {
              return (
                <img
                  key={overlay.id}
                  src={`${overlay.imageUrl}${cacheBust}`}
                  alt=""
                  style={{
                    position: 'absolute',
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    width: `${overlay.width}%`,
                    height: `${overlay.height}%`,
                    objectFit: 'fill',
                    pointerEvents: 'none',
                  }}
                />
              );
            }

            // Crop: container clips to the visible area, image is scaled up
            // to account for the cropped edges
            const visibleW = 1 - overlay.cropLeft - overlay.cropRight;
            const visibleH = 1 - overlay.cropTop - overlay.cropBottom;
            const imgWidthPct = (1 / visibleW) * 100;
            const imgHeightPct = (1 / visibleH) * 100;
            const imgLeftPct = -(overlay.cropLeft / visibleW) * 100;
            const imgTopPct = -(overlay.cropTop / visibleH) * 100;

            return (
              <div
                key={overlay.id}
                style={{
                  position: 'absolute',
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  width: `${overlay.width}%`,
                  height: `${overlay.height}%`,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={`${overlay.imageUrl}${cacheBust}`}
                  alt=""
                  style={{
                    position: 'absolute',
                    width: `${imgWidthPct}%`,
                    height: `${imgHeightPct}%`,
                    left: `${imgLeftPct}%`,
                    top: `${imgTopPct}%`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Navigation overlays */}
        <div
          onClick={() => goToSlide(currentSlide - 1)}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: '15%',
            cursor: currentSlide > 0 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            paddingLeft: 16, opacity: 0, transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = currentSlide > 0 ? 1 : 0}
          onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
        >
          {currentSlide > 0 && <ChevronLeft size={48} />}
        </div>
        <div
          onClick={() => goToSlide(currentSlide + 1)}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '15%',
            cursor: currentSlide < meta.slideCount - 1 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 16, opacity: 0, transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = currentSlide < meta.slideCount - 1 ? 1 : 0}
          onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
        >
          {currentSlide < meta.slideCount - 1 && <ChevronRight size={48} />}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', fontSize: 13, color: subtleColor, flexShrink: 0,
      }}>
        <span>{meta.title}</span>
        <span>{currentSlide + 1} / {meta.slideCount}</span>
      </div>
    </div>
  );
}
