// src/ui/ThemeSwitcher.tsx
// Theme selector dropdown (Light / Dark / System)

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../state/appStore'
import { useResolvedTheme, type Theme } from '../hooks/useResolvedTheme'
import { useTranslation } from '../i18n/useTranslation'

const THEMES: Theme[] = ['light', 'dark', 'system']

const THEME_ICONS: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
}

export default function ThemeSwitcher() {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const resolvedTheme = useResolvedTheme()
  const t = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const handleSelect = (newTheme: Theme) => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  return (
    <div className="theme-switcher" ref={dropdownRef}>
      <button
        className="theme-switcher__toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t.theme}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={t.theme}
      >
        <span className="theme-switcher__icon">
          {theme === 'system' ? THEME_ICONS[resolvedTheme] : THEME_ICONS[theme]}
        </span>
        <span className="theme-switcher__arrow">{isOpen ? '▼' : '▼'}</span>
      </button>

      {isOpen && (
        <ul className="theme-switcher__dropdown" role="listbox">
          {THEMES.map((themeOption) => (
            <li key={themeOption}>
              <button
                className={`theme-switcher__option ${themeOption === theme ? 'theme-switcher__option--active' : ''}`}
                onClick={() => handleSelect(themeOption)}
                role="option"
                aria-selected={themeOption === theme}
              >
                <span className="theme-switcher__icon">{THEME_ICONS[themeOption]}</span>
                <span className="theme-switcher__name">
                  {themeOption === 'light' && t.themeLight}
                  {themeOption === 'dark' && t.themeDark}
                  {themeOption === 'system' && t.themeSystem}
                </span>
                {themeOption === theme && <span className="theme-switcher__check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
