import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'bg' | 'en'

const STORAGE_KEY = 'imoti-bg-lang'

type Dictionary = Record<string, string>

const dictionaries: Record<Lang, Dictionary> = {
  bg: {
    'header.brand': 'Имоти BG',
    'header.logoInitial': 'И',
    'header.postListing': 'Публикувай обява',
    'header.myListings': 'Моите обяви',

    'home.loading': 'Зареждане на обяви…',
    'home.empty': 'Няма обяви в тази област. Опитайте да отдалечите картата или да промените филтрите.',
    'home.count': '{count} обяви',

    'filter.searchPlaceholder': 'Търсене на адрес или квартал…',
    'filter.clearSearch': 'Изчисти търсенето',
    'filter.searching': 'Търсене…',
    'filter.noMatches': 'Няма намерени резултати.',
    'filter.priceUpToPrefix': 'до',
    'filter.priceShowAll': 'Всички',
    'filter.typeAll': 'Всички',
    'filter.typeRoom': 'Стая',
    'filter.typeFlat': 'Апартамент',
    'filter.typeHouse': 'Къща',

    'listing.perMonth': '/ месец',
    'listing.call': 'Обади се {phone}',
    'listing.prevPhoto': 'Предишна снимка',
    'listing.nextPhoto': 'Следваща снимка',

    'detail.back': 'Обратно към {count} обяви',
    'detail.photoIndex': '{current} / {total}',
    'detail.postedBy': 'Публикувано от собственик',
    'detail.notFound': 'Обявата не е намерена.',
    'detail.backHome': 'Обратно към началото',
    'detail.loading': 'Зареждане…',

    'toggle.list': 'Списък',
    'toggle.map': 'Карта',

    'postModal.title': 'Публикувай обява',
    'postModal.description': 'Попълнете детайлите по-долу. Ще се появи на картата веднага.',
    'postModal.fieldTitle': 'Заглавие',
    'postModal.fieldTitlePlaceholder': 'Уютен двустаен до бул. Витоша',
    'postModal.fieldDescription': 'Описание',
    'postModal.fieldDescriptionPlaceholder': 'Детайли за имота, удобства, наличност…',
    'postModal.fieldPrice': 'Цена (EUR / месец)',
    'postModal.fieldType': 'Тип',
    'postModal.fieldPhone': 'Телефон',
    'postModal.location': 'Локация',
    'postModal.useMyLocation': 'Използвай моята локация',
    'postModal.locationHint': 'Кликнете върху картата или преместете иглата, за да зададете точна локация.',
    'postModal.photos': 'Снимки',
    'postModal.photosHint': 'До {max} снимки, по 5MB всяка.',
    'postModal.cancel': 'Отказ',
    'postModal.submit': 'Публикувай обява',
    'postModal.submitting': 'Публикуване…',
    'postModal.errorTitleRequired': 'Заглавието е задължително.',
    'postModal.errorPriceInvalid': 'Въведете валидна цена.',
    'postModal.errorPhoneInvalid': 'Въведете валиден български мобилен номер, напр. 0888 123 456.',
    'postModal.errorGeoUnsupported': 'Браузърът ви не поддържа геолокация.',
    'postModal.errorGeoDenied': 'Не успяхме да достъпим локацията ви. Проверете разрешенията на браузъра.',
    'postModal.successPosted': 'Обявата е публикувана.',
    'postModal.errorGeneric': 'Нещо се обърка. Опитайте отново.',
  },
  en: {
    'header.brand': 'Imoti BG',
    'header.logoInitial': 'I',
    'header.postListing': 'Post a listing',
    'header.myListings': 'My listings',

    'home.loading': 'Loading listings…',
    'home.empty': 'No listings in this area. Try zooming out or adjusting filters.',
    'home.count': '{count} listings',

    'filter.searchPlaceholder': 'Search address or neighborhood…',
    'filter.clearSearch': 'Clear search',
    'filter.searching': 'Searching…',
    'filter.noMatches': 'No matches found.',
    'filter.priceUpToPrefix': 'up to',
    'filter.priceShowAll': 'Show all',
    'filter.typeAll': 'All',
    'filter.typeRoom': 'Room',
    'filter.typeFlat': 'Flat',
    'filter.typeHouse': 'House',

    'listing.perMonth': '/ month',
    'listing.call': 'Call {phone}',
    'listing.prevPhoto': 'Previous photo',
    'listing.nextPhoto': 'Next photo',

    'detail.back': 'Back to {count} listings',
    'detail.photoIndex': '{current} / {total}',
    'detail.postedBy': 'Posted by owner',
    'detail.notFound': 'Listing not found.',
    'detail.backHome': 'Back to home',
    'detail.loading': 'Loading…',

    'toggle.list': 'List',
    'toggle.map': 'Map',

    'postModal.title': 'Post a listing',
    'postModal.description': "Fill in the details below. It'll appear on the map instantly.",
    'postModal.fieldTitle': 'Title',
    'postModal.fieldTitlePlaceholder': 'Cozy 1-bedroom near Vitosha Blvd',
    'postModal.fieldDescription': 'Description',
    'postModal.fieldDescriptionPlaceholder': 'Details about the place, amenities, availability…',
    'postModal.fieldPrice': 'Price (EUR / month)',
    'postModal.fieldType': 'Type',
    'postModal.fieldPhone': 'Phone',
    'postModal.location': 'Location',
    'postModal.useMyLocation': 'Use my location',
    'postModal.locationHint': 'Click on the map or drag the pin to set the exact location.',
    'postModal.photos': 'Photos',
    'postModal.photosHint': 'Up to {max} photos, 5MB each.',
    'postModal.cancel': 'Cancel',
    'postModal.submit': 'Post listing',
    'postModal.submitting': 'Posting…',
    'postModal.errorTitleRequired': 'Title is required.',
    'postModal.errorPriceInvalid': 'Enter a valid price.',
    'postModal.errorPhoneInvalid': 'Enter a valid Bulgarian mobile number, e.g. 0888 123 456.',
    'postModal.errorGeoUnsupported': 'Your browser does not support geolocation.',
    'postModal.errorGeoDenied': 'Could not access your location. Check your browser permissions.',
    'postModal.successPosted': 'Listing posted.',
    'postModal.errorGeneric': 'Something went wrong. Please try again.',
  },
}

type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Vars) => string
}

const LangContext = createContext<LangContextValue | null>(null)

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'bg'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'bg' || stored === 'en' ? stored : 'bg'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  function setLang(next: Lang) {
    setLangState(next)
  }

  function t(key: string, vars?: Vars): string {
    const dictionary = dictionaries[lang]
    const template = dictionary[key] ?? dictionaries.bg[key] ?? key
    return interpolate(template, vars)
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within a LangProvider')
  return ctx
}
