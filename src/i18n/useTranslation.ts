// src/i18n/useTranslation.ts
// Hook for accessing translations

import { useMemo } from 'react'
import { useAppStore } from '../state/appStore'
import { getTranslations, type TranslationStrings } from './translations'

export function useTranslation(): TranslationStrings {
  const locale = useAppStore((state) => state.locale)
  
  return useMemo(() => getTranslations(locale), [locale])
}

export function useLocale() {
  const locale = useAppStore((state) => state.locale)
  const setLocale = useAppStore((state) => state.setLocale)
  
  return { locale, setLocale }
}
