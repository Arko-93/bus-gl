// src/ui/InfoModal.tsx
// Info modal showing data sources, credits, and cookie information

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info, X, ExternalLink } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'

export default function InfoModal() {
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslation()

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  // Close when clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false)
    }
  }

  const modalContent = isOpen ? (
    <div className="info-modal__backdrop" onClick={handleBackdropClick}>
      <div className="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
        <button
          className="info-modal__close"
          onClick={() => setIsOpen(false)}
          aria-label={t.close}
        >
          <X size={18} />
        </button>

        <h2 id="info-modal-title" className="info-modal__title">{t.aboutApp}</h2>

        <div className="info-modal__content">
          <section className="info-modal__section">
            <h3>{t.dataSources}</h3>
            <ul className="info-modal__list">
              <li>
                <strong>{t.realtimeBusData}</strong>
                <br />
                <span className="info-modal__source">
                  {t.providedBy}{' '}
                  <a href="https://www.ridango.com" target="_blank" rel="noopener noreferrer">
                    Ridango <ExternalLink size={12} />
                  </a>
                </span>
              </li>
              <li>
                <strong>{t.busStopsAndRoutes}</strong>
                <br />
                <span className="info-modal__source">
                  {t.ownedBy}{' '}
                  <a href="https://bus.gl" target="_blank" rel="noopener noreferrer">
                    Nuup Bussii A/S <ExternalLink size={12} />
                  </a>
                </span>
              </li>
              <li>
                <strong>{t.mapData}</strong>
                <br />
                <span className="info-modal__source">
                  © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                    OpenStreetMap <ExternalLink size={12} />
                  </a>{' '}
                  {t.contributors}
                </span>
              </li>
            </ul>
          </section>

          <section className="info-modal__section">
            <h3>{t.cookiesTitle}</h3>
            <p className="info-modal__text">{t.cookiesDescription}</p>
            <ul className="info-modal__list info-modal__list--compact">
              <li><code>locale</code> – {t.cookieLocale}</li>
              <li><code>theme</code> – {t.cookieTheme}</li>
            </ul>
          </section>

          <section className="info-modal__section">
            <h3>{t.disclaimer}</h3>
            <p className="info-modal__text">{t.disclaimerText}</p>
          </section>
        </div>

        <footer className="info-modal__footer">
          <p>
            {t.builtBy}{' '}
            <strong>Ole Olsvig</strong>
          </p>
        </footer>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        className="info-btn"
        onClick={() => setIsOpen(true)}
        aria-label={t.aboutApp}
        title={t.aboutApp}
      >
        <Info size={18} />
      </button>

      {modalContent && createPortal(modalContent, document.body)}
    </>
  )
}
