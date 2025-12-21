// src/i18n/translations.ts
// Translations for Kalaallisut, Dansk, and English

export type Locale = 'kl' | 'da' | 'en'

export const LOCALE_NAMES: Record<Locale, string> = {
  kl: 'Kalaallisut',
  da: 'Dansk',
  en: 'English',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  kl: '🇬🇱', // Greenland
  da: '🇩🇰', // Denmark
  en: '🇬🇧', // UK
}

export interface TranslationStrings {
  // App title
  appTitle: string
  
  // TopBar
  loading: string
  updating: string
  live: string
  buses: string
  bus: string
  updated: string
  stale: string
  
  // Route filter
  filterByRoute: string
  allRoutes: string
  route: string
  
  // Bus details
  speed: string
  kmh: string
  currentStop: string
  nextStop: string
  inTransit: string
  unknown: string
  atStop: string
  dataOutdated: string
  
  // Time
  secondsAgo: string
  minutesAgo: string
  hoursAgo: string
  
  // Bottom sheet / Popup
  close: string
  closePopup: string
  detailsFor: string
  
  // Errors
  connectionError: string
  retrying: string
  
  // Loading
  loadingBuses: string
  
  // Search
  searchStops: string
  
  // Language
  language: string

  // Theme
  theme: string
  themeLight: string
  themeDark: string
  themeSystem: string
}

const translations: Record<Locale, TranslationStrings> = {
  // Kalaallisut (Greenlandic)
  kl: {
    appTitle: 'Bussit',
    loading: 'Aajuitsilluni...',
    updating: 'Nutarterneq...',
    live: 'Sunaaffik',
    buses: 'bussit',
    bus: 'bussi',
    updated: 'Nutarterneqarpoq',
    stale: 'utoqqaq',
    filterByRoute: 'Bussilersortaq toqqaruk',
    allRoutes: 'Tamarmik',
    route: 'Bussilersortaq',
    speed: 'Sukkanersoq',
    kmh: 'km/t',
    currentStop: 'Maannakkut uninnga',
    nextStop: 'Tulleq uninnga',
    inTransit: 'Angallasarpoq',
    unknown: 'Nalunaarsorneqanngilaq',
    atStop: 'Uninngami',
    dataOutdated: 'Paasissutissat utoqqaapput',
    secondsAgo: 's matuma siorna',
    minutesAgo: 'm matuma siorna',
    hoursAgo: 't matuma siorna',
    close: 'Matusuk',
    closePopup: 'Ilanngussaq matuk',
    detailsFor: 'Paasissutissat',
    connectionError: 'Attaveqarnermut ajutoorneq',
    retrying: 'Misileqqaarpoq...',
    loadingBuses: 'Bussit aajuitsillugit...',
    searchStops: 'Uninngat ujaruk',
    language: 'Oqaatsit',
    theme: 'Qaammat',
    themeLight: 'Qaammat',
    themeDark: 'Taartoq',
    themeSystem: 'Systemimi',
  },
  
  // Dansk (Danish)
  da: {
    appTitle: 'Bussit',
    loading: 'Indlæser...',
    updating: 'Opdaterer...',
    live: 'Live',
    buses: 'busser',
    bus: 'bus',
    updated: 'Opdateret',
    stale: 'forældet',
    filterByRoute: 'Filtrer efter rute',
    allRoutes: 'Alle',
    route: 'Rute',
    speed: 'Hastighed',
    kmh: 'km/t',
    currentStop: 'Nuværende stop',
    nextStop: 'Næste stop',
    inTransit: 'Undervejs',
    unknown: 'Ukendt',
    atStop: 'Ved stoppested',
    dataOutdated: 'Data kan være forældet',
    secondsAgo: 's siden',
    minutesAgo: 'm siden',
    hoursAgo: 't siden',
    close: 'Luk',
    closePopup: 'Luk popup',
    detailsFor: 'Detaljer for',
    connectionError: 'Forbindelsesfejl',
    retrying: 'Prøver igen...',
    loadingBuses: 'Indlæser busser...',
    searchStops: 'Søg stoppesteder',
    language: 'Sprog',
    theme: 'Tema',
    themeLight: 'Lys',
    themeDark: 'Mørk',
    themeSystem: 'System',
  },
  
  // English
  en: {
    appTitle: 'Bussit',
    loading: 'Loading...',
    updating: 'Updating...',
    live: 'Live',
    buses: 'buses',
    bus: 'bus',
    updated: 'Updated',
    stale: 'stale',
    filterByRoute: 'Filter buses by route',
    allRoutes: 'All',
    route: 'Route',
    speed: 'Speed',
    kmh: 'km/h',
    currentStop: 'Current stop',
    nextStop: 'Next stop',
    inTransit: 'In transit',
    unknown: 'Unknown',
    atStop: 'At stop',
    dataOutdated: 'Data may be outdated',
    secondsAgo: 's ago',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    close: 'Close',
    closePopup: 'Close popup',
    detailsFor: 'Details for',
    connectionError: 'Connection error',
    retrying: 'Retrying...',
    loadingBuses: 'Loading buses...',
    searchStops: 'Search stops',
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
  },
}

export function getTranslations(locale: Locale): TranslationStrings {
  return translations[locale]
}

export function detectBrowserLocale(): Locale {
  const browserLang = navigator.language.toLowerCase()
  
  if (browserLang.startsWith('kl') || browserLang === 'kalaallisut') {
    return 'kl'
  }
  if (browserLang.startsWith('da')) {
    return 'da'
  }
  // Default to English
  return 'en'
}

export default translations
