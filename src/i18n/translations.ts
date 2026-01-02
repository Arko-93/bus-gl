// src/i18n/translations.ts
// Translations for Kalaallisut, Dansk, and English

export type Locale = 'kl' | 'da' | 'en'

export const LOCALE_NAMES: Record<Locale, string> = {
  kl: 'Kalaallisut',
  da: 'Dansk',
  en: 'English',
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
  busCount: string // Template with {count} placeholder
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
  scheduleWeekdays: string
  scheduleWeekends: string
  noSchedule: string
  serviceEnded: string
  
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
  fromStop: string
  toStop: string
  fullRoute: string
  chooseTrip: string
  chooseStop: string
  
  // Language
  language: string

  // Theme
  theme: string
  themeLight: string
  themeDark: string
  themeSystem: string

  // Info modal
  aboutApp: string
  dataSources: string
  realtimeBusData: string
  busStopsAndRoutes: string
  mapData: string
  providedBy: string
  ownedBy: string
  contributors: string
  cookiesTitle: string
  cookiesDescription: string
  cookieLocale: string
  cookieTheme: string
  disclaimer: string
  disclaimerText: string
  builtBy: string
}

const translations: Record<Locale, TranslationStrings> = {
  // Kalaallisut (Greenlandic)
  kl: {
    appTitle: 'BUSSIT',
    loading: 'Nuisinneqalerpoq...',
    updating: 'Nutarterneqarpoq...',
    live: 'Toqqaannartoq',
    buses: 'bussit',
    bus: 'bussi',
    busCount: 'Bussit ataatsit ingerlapput',
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
    inTransit: 'Aallarpoq',
    unknown: 'Nalunaarsorneqanngilaq',
    atStop: 'Unittarfimmi',
    atDepot: 'Qatserisuni',
    dataOutdated: 'Paasissutissat nutartingassaapput',
    busHere: 'Massakkut unittarfimmukartut',
    arriving: 'Piffissaq apuuffissaq',
    stopDetails: 'Unittarfimmut paasissutissat',
    noBusesAtStop: 'Bussinik maani uninngasoqanngilaq',
    scheduleWeekdays: 'Ulluinnarni',
    scheduleWeekends: 'Sapaatip naanerani',
    noSchedule: 'Nalunaarsugaq pissanngilaq',
    serviceEnded: 'Sullissineq naammat',
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
    clearFilters: 'Peeruk',
    stopsFiltered: 'unittarfiit toqqakkat',
    fromStop: 'Ikiffissaq',
    toStop: 'Niuffissaq',
    fullRoute: 'Ingerlavik tamaat',
    chooseTrip: 'Angallavissaq toqqaruk',
    chooseStop: 'Unittarfik toqqaruk',
    language: 'Oqaatsit',
    theme: 'Qaamassusaa',
    themeLight: 'Qaamasoq',
    themeDark: 'Taartoq',
    themeSystem: 'Systemip qaamassusaa',
    aboutApp: 'Bussit pillugit Paasissutissat',
    dataSources: 'Paasissutissat aallaavii',
    realtimeBusData: 'Bussit sumiiffii toqqaannartumik malinnaavigineri',
    busStopsAndRoutes: 'Bussit, unittarfiit bussillu ingerlavii',
    mapData: 'Nunap assingi',
    providedBy: 'Attavinnik pilersitsisut:',
    ownedBy: 'Pigineqarput:',
    contributors: 'ilaasortaasut',
    cookiesTitle: 'Cookies',
    cookiesDescription: 'Uumma app-ip paasissutissat atorneqartut qarasaasiami imaluunniit oqarasuaammi angallattakkami taamaallaat toqqortarpaai. Sumiiffissiuut atorneqanngilaq. Paasissutissat atorneqartut:',
    cookieLocale: 'Oqaatsit atussallugit toqqakkatit',
    cookieTheme: 'Qaamassuseq illit toqqakkat',
    disclaimer: 'Paasissutissanik piginnittut',
    disclaimerText: 'Bussinut tunngasut paasissutissat uani atorneqartut Nuup Bussii A/S-imit aammalu Ridango-mit pigineqarput. Una appi bussit ingerlanerinut paasissutissanik pisortatigoortumik aallaaviunngilaq.',
    builtBy: 'App-imik sanasoq:',
  },
  
  // Dansk (Danish)
  da: {
    appTitle: 'BUSSIT',
    loading: 'Indlæser...',
    updating: 'Opdaterer...',
    live: 'Live',
    buses: 'busser',
    bus: 'bus',
    busCount: '{count} bus i drift',
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
    busHere: 'På vej hertil',
    arriving: 'ankommer',
    stopDetails: 'Stopsted info',
    noBusesAtStop: 'Ingen busser ved dette stop',
    scheduleWeekdays: 'Hverdage',
    scheduleWeekends: 'Weekend & helligdage',
    noSchedule: 'Ingen køreplan tilgængelig',
    serviceEnded: 'Kørslen afsluttet',
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
    clearFilters: 'Ryd rute',
    stopsFiltered: 'stop valgt',
    fromStop: 'Fra',
    toStop: 'Til',
    fullRoute: 'Hele ruten',
    chooseTrip: 'Vælg tur',
    chooseStop: 'Vælg stop',
    language: 'Sprog',
    theme: 'Tema',
    themeLight: 'Lys',
    themeDark: 'Mørk',
    themeSystem: 'System',
    aboutApp: 'Om appen',
    dataSources: 'Datakilder',
    realtimeBusData: 'Buspositioner i realtid',
    busStopsAndRoutes: 'Stoppesteder og ruter',
    mapData: 'Kortdata',
    providedBy: 'Leveret af',
    ownedBy: 'Ejet af',
    contributors: 'bidragydere',
    cookiesTitle: 'Cookies',
    cookiesDescription: 'Denne app gemmer kun lokale cookies. Ingen sporing:',
    cookieLocale: 'Dit valgte sprog',
    cookieTheme: 'Dit valgte tema',
    disclaimer: 'Ansvarsfraskrivelse',
    disclaimerText: 'Buspositionsdata ejes af Nuup Bussii A/S og Ridango. Denne app er ikke en officiel kilde til buskøreplaner.',
    builtBy: 'Udviklet af',
  },
  
  // English
  en: {
    appTitle: 'BUSSIT',
    loading: 'Loading...',
    updating: 'Updating...',
    live: 'Live',
    buses: 'buses',
    bus: 'bus',
    busCount: '{count} bus operating',
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
    busHere: 'Heading here',
    arriving: 'arriving',
    stopDetails: 'Stop details',
    noBusesAtStop: 'No buses at this stop',
    scheduleWeekdays: 'Weekdays',
    scheduleWeekends: 'Weekends & holidays',
    noSchedule: 'No schedule available',
    serviceEnded: 'Service ended',
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
    clearFilters: 'Clear route',
    stopsFiltered: 'stops selected',
    fromStop: 'From',
    toStop: 'To',
    fullRoute: 'Full route',
    chooseTrip: 'Choose trip',
    chooseStop: 'Choose stop',
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    aboutApp: 'About',
    dataSources: 'Data Sources',
    realtimeBusData: 'Realtime bus positions',
    busStopsAndRoutes: 'Bus stops and routes',
    mapData: 'Map data',
    providedBy: 'Provided by',
    ownedBy: 'Owned by',
    contributors: 'contributors',
    cookiesTitle: 'Cookies',
    cookiesDescription: 'This app only saves local cookies. No tracking:',
    cookieLocale: 'Your selected language',
    cookieTheme: 'Your selected theme',
    disclaimer: 'Disclaimer',
    disclaimerText: 'Bus tracking data is owned by Nuup Bussii A/S and Ridango. This app is not an official source for bus schedules.',
    builtBy: 'Built by',
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
