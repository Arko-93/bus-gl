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
  busesCount: string // Template with {count} placeholder
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
  atDepot: string
  dataOutdated: string
  
  // Stop details
  busHere: string
  arriving: string
  stopDetails: string
  noBusesAtStop: string
  
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
  
  // Stop filter
  filterStops: string
  busStops: string
  showAllStops: string
  hideAllStops: string
  clearFilters: string
  stopsFiltered: string
  
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
    loading: 'Nuisinneqalerpoq...',
    updating: 'Nutarterneqarpoq...',
    live: 'Toqqaannartoq',
    buses: 'bussit',
    bus: 'bussi',
    busesCount: 'Bussit {count}-t ingerlapput',
    updated: 'Nutarterneqarfia',
    stale: 'attaviluttoq',
    filterByRoute: 'Bussit ingerlaviat toqqaruk',
    allRoutes: 'Tamarmik',
    route: 'Bussit ingerlaviat',
    speed: 'Sukkassusaa',
    kmh: 'km/t',
    currentStop: 'Massakkut ornitaq',
    nextStop: 'Uniffissaq tulleq',
    inTransit: 'Ingerlavoq',
    unknown: 'Nalunaarsorneqanngilaq',
    atStop: 'Unittarfimmi',
    atDepot: 'Qatserisuni',
    dataOutdated: 'Paasissutissat nutartingassaapput',
    busHere: 'Bussi maaniippoq',
    arriving: 'Piffissaq apuuffissaq',
    stopDetails: 'Unittarfimmut paasissutissat',
    noBusesAtStop: 'Bussinik maani uninngasoqanngilaq',
    secondsAgo: 's matuma siorna',
    minutesAgo: 'm matuma siorna',
    hoursAgo: ' ak. matuma siorna',
    close: 'Matujuk',
    closePopup: 'Paasissutissaq matujuk',
    detailsFor: 'Paasissutissat',
    connectionError: 'Attaveeqaatit ajutoorput',
    retrying: 'Attavit misileqqinneqarput...',
    loadingBuses: 'Bussit attaveqaatitigut nuisinneqalerput...',
    searchStops: 'Unittarfiit ujakkit',
    filterStops: 'Unittarfiit toqqaruk',
    busStops: 'Unittarfiit',
    showAllStops: 'Tamarmik',
    hideAllStops: 'Tarrisuk',
    clearFilters: 'Tamarmik peeruk',
    stopsFiltered: 'unittarfiit toqqakkat',
    language: 'Oqaatsit',
    theme: 'Qaamasoq',
    themeLight: 'Qaamasoq',
    themeDark: 'Taartoq',
    themeSystem: 'Systemip qaamassusaa',
  },
  
  // Dansk (Danish)
  da: {
    appTitle: 'Bussit',
    loading: 'Indlæser...',
    updating: 'Opdaterer...',
    live: 'Live',
    buses: 'busser',
    bus: 'bus',
    busesCount: '{count} busser i drift',
    updated: 'Opdateret',
    stale: 'forældet',
    filterByRoute: 'Filtrer efter rute',
    allRoutes: 'Alle',
    route: 'Rute',
    speed: 'Hastighed',
    kmh: 'km/t',
    currentStop: 'Nuværende destination',
    nextStop: 'Næste stop',
    inTransit: 'Undervejs',
    unknown: 'Ukendt',
    atStop: 'Ved stoppested',
    atDepot: 'I depot',
    dataOutdated: 'Data kan være forældet',
    busHere: 'Bussen er her',
    arriving: 'ankommer',
    stopDetails: 'Stopsted info',
    noBusesAtStop: 'Ingen busser ved dette stop',
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
    filterStops: 'Filtrer stoppesteder',
    busStops: 'Stoppesteder',
    showAllStops: 'Vis alle',
    hideAllStops: 'Skjul alle',
    clearFilters: 'Ryd alle',
    stopsFiltered: 'stop valgt',
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
    busesCount: '{count} buses operating',
    updated: 'Updated',
    stale: 'stale',
    filterByRoute: 'Filter buses by route',
    allRoutes: 'All',
    route: 'Route',
    speed: 'Speed',
    kmh: 'km/h',
    currentStop: 'Current destination',
    nextStop: 'Next stop',
    inTransit: 'In transit',
    unknown: 'Unknown',
    atStop: 'At stop',
    atDepot: 'At depot',
    dataOutdated: 'Data may be outdated',
    busHere: 'Bus is here',
    arriving: 'arriving',
    stopDetails: 'Stop details',
    noBusesAtStop: 'No buses at this stop',
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
    filterStops: 'Filter stops',
    busStops: 'Bus stops',
    showAllStops: 'Show all',
    hideAllStops: 'Hide all',
    clearFilters: 'Clear all',
    stopsFiltered: 'stops selected',
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
