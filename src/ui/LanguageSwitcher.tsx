// src/ui/LanguageSwitcher.tsx
// Language selector dropdown

import { useState, useRef, useEffect } from 'react'
import { useLocale } from '../i18n/useTranslation'
import { LOCALE_NAMES, LOCALE_FLAGS, type Locale } from '../i18n/translations'

const LOCALES: Locale[] = ['kl', 'da', 'en']

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale)
    setIsOpen(false)
  }

  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button
        className="language-switcher__toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Language: ${LOCALE_NAMES[locale]}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="language-switcher__flag">{LOCALE_FLAGS[locale]}</span>
        <span className="language-switcher__code">{locale.toUpperCase()}</span>
        <span className="language-switcher__arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <ul className="language-switcher__dropdown" role="listbox">
          {LOCALES.map((loc) => (
            <li key={loc}>
              <button
                className={`language-switcher__option ${loc === locale ? 'language-switcher__option--active' : ''}`}
                onClick={() => handleSelect(loc)}
                role="option"
                aria-selected={loc === locale}
              >
                <span className="language-switcher__flag">{LOCALE_FLAGS[loc]}</span>
                <span className="language-switcher__name">{LOCALE_NAMES[loc]}</span>
                {loc === locale && <span className="language-switcher__check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
