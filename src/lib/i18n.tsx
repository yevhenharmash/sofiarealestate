import { createContext, useContext, type ReactNode } from 'react'
import { useLocalStorage } from 'usehooks-ts'

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
    'detail.closePhoto': 'Затвори снимката',

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
    'postModal.fieldStatus': 'Статус',
    'postModal.fieldPhone': 'Телефон',
    'postModal.addNewPhone': '+ Добави нов номер',
    'postModal.useSavedPhone': 'Използвай запазен номер',
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
    'postModal.errorPhoneInvalid': 'Въведете валиден телефонен номер, напр. 0888 123 456.',
    'postModal.errorGeoUnsupported': 'Браузърът ви не поддържа геолокация.',
    'postModal.errorGeoDenied': 'Не успяхме да достъпим локацията ви. Проверете разрешенията на браузъра.',
    'postModal.successPosted': 'Обявата е публикувана.',
    'postModal.errorGeneric': 'Нещо се обърка. Опитайте отново.',

    'auth.signInTitle': 'Добре дошли',
    'auth.signInDescription': 'Влезте, за да видите всички обяви и да се свържете с наемодателите.',
    'auth.continueWithGoogle': 'Влезте с Google',
    'auth.firstTimeHint': 'Първи път? Ще създадем профил автоматично',
    'auth.termsPrefix': 'С влизане приемате нашите',
    'auth.termsLinkText': 'Условия и политика за поверителност',
    'auth.phoneNumbers': 'Телефонни номера',
    'auth.addPhone': 'Добави',
    'auth.phonePlaceholder': '0888 123 456',
    'auth.removePhone': 'Премахни номера',

    'profile.title': 'Профил',
    'profile.close': 'Затвори',
    'profile.changePhoto': 'Кликнете, за да смените снимката',
    'profile.changePhotoHint': 'Кликнете върху снимката, за да я смените',
    'profile.name': 'Име',
    'profile.namePlaceholder': 'Вашето име',
    'profile.addPhone': 'Добавете телефон',
    'profile.cancel': 'Откажи',
    'profile.save': 'Запази',
    'profile.saved': 'Профилът е запазен.',
    'profile.signOut': 'Изход',

    'myListings.back': 'Обратно към картата',
    'myListings.title': 'Моите обяви',
    'myListings.loading': 'Зареждане на обявите…',
    'myListings.filterAll': 'Всички ({count})',
    'myListings.filterActive': 'Активни ({count})',
    'myListings.filterDraft': 'Чернови ({count})',
    'myListings.filterExpired': 'Изтекли ({count})',
    'myListings.statusActive': 'Активна',
    'myListings.statusDraft': 'Чернова',
    'myListings.statusExpired': 'Изтекла',
    'myListings.edit': 'Редактирай',
    'myListings.deleteAria': 'Изтрий обявата',
    'myListings.emptyTitle': 'Нямате публикувани обяви',
    'myListings.emptyText': 'Създайте своя първа обява и я направете видима за хиляди наематели.',
    'myListings.deleteConfirmTitle': 'Изтривам обява?',
    'myListings.deleteConfirmText': 'Тази обява ще бъде премахната завинаги. Не можете да я възстановите.',
    'myListings.deleteConfirm': 'Изтрий',
    'myListings.editTitle': 'Редактирай обява',
    'myListings.deleted': 'Обявата е изтрита.',
    'myListings.updated': 'Обявата е обновена.',
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
    'detail.closePhoto': 'Close photo',

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
    'postModal.fieldStatus': 'Status',
    'postModal.fieldPhone': 'Phone',
    'postModal.addNewPhone': '+ Add a new number',
    'postModal.useSavedPhone': 'Use a saved number',
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
    'postModal.errorPhoneInvalid': 'Enter a valid phone number, e.g. 0888 123 456.',
    'postModal.errorGeoUnsupported': 'Your browser does not support geolocation.',
    'postModal.errorGeoDenied': 'Could not access your location. Check your browser permissions.',
    'postModal.successPosted': 'Listing posted.',
    'postModal.errorGeneric': 'Something went wrong. Please try again.',

    'auth.signInTitle': 'Welcome',
    'auth.signInDescription': 'Sign in to see every listing and get in touch with landlords.',
    'auth.continueWithGoogle': 'Continue with Google',
    'auth.firstTimeHint': "First time here? We'll create your profile automatically",
    'auth.termsPrefix': 'By signing in you agree to our',
    'auth.termsLinkText': 'Terms and Privacy Policy',
    'auth.phoneNumbers': 'Phone numbers',
    'auth.addPhone': 'Add',
    'auth.phonePlaceholder': '0888 123 456',
    'auth.removePhone': 'Remove phone number',

    'profile.title': 'Profile',
    'profile.close': 'Close',
    'profile.changePhoto': 'Click to change your photo',
    'profile.changePhotoHint': 'Click your photo to change it',
    'profile.name': 'Name',
    'profile.namePlaceholder': 'Your name',
    'profile.addPhone': 'Add a phone number',
    'profile.cancel': 'Cancel',
    'profile.save': 'Save',
    'profile.saved': 'Profile saved.',
    'profile.signOut': 'Sign out',

    'myListings.back': 'Back to the map',
    'myListings.title': 'My listings',
    'myListings.loading': 'Loading your listings…',
    'myListings.filterAll': 'All ({count})',
    'myListings.filterActive': 'Active ({count})',
    'myListings.filterDraft': 'Drafts ({count})',
    'myListings.filterExpired': 'Expired ({count})',
    'myListings.statusActive': 'Active',
    'myListings.statusDraft': 'Draft',
    'myListings.statusExpired': 'Expired',
    'myListings.edit': 'Edit',
    'myListings.deleteAria': 'Delete listing',
    'myListings.emptyTitle': "You haven't posted any listings",
    'myListings.emptyText': 'Create your first listing and make it visible to thousands of renters.',
    'myListings.deleteConfirmTitle': 'Delete this listing?',
    'myListings.deleteConfirmText': "It'll be removed permanently. You can't undo this.",
    'myListings.deleteConfirm': 'Delete',
    'myListings.editTitle': 'Edit listing',
    'myListings.deleted': 'Listing deleted.',
    'myListings.updated': 'Listing updated.',
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

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLocalStorage<Lang>(STORAGE_KEY, 'bg')

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
