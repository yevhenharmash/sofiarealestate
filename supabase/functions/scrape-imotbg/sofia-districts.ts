// Approximate centroids for well-known Sofia districts/neighborhoods, seeded
// from public OSM/Wikipedia data -- NOT from imot.bg, which never exposes
// exact coordinates on its public pages. Used only to place a jittered,
// approximate pin; see geocodeDistrict below.
//
// Keys match the district name as it appears on imot.bg after stripping the
// "град София, " prefix (e.g. "град София, Оборище" -> "Оборище").
export const SOFIA_DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  'Център': [42.6953, 23.3220],
  Оборище: [42.6930, 23.3350],
  Възраждане: [42.6960, 23.3080],
  'Света Троица': [42.7080, 23.2950],
  'Захарна фабрика': [42.6980, 23.2850],
  'Иван Вазов': [42.6800, 23.3050],
  'Красно село': [42.6850, 23.2950],
  Илинден: [42.7050, 23.2900],
  Банишора: [42.7080, 23.3150],
  Конявица: [42.6900, 23.3000],
  'Фондови жилища': [42.7000, 23.2600],
  Надежда: [42.7280, 23.2950],
  Люлин: [42.7050, 23.2450],
  Обеля: [42.7250, 23.2550],
  Враждебна: [42.6950, 23.4200],
  Дружба: [42.6550, 23.3850],
  Искър: [42.6600, 23.3800],
  Младост: [42.6450, 23.3800],
  'Студентски град': [42.6480, 23.3350],
  Изток: [42.6750, 23.3450],
  Изгрев: [42.6750, 23.3500],
  'Гео Милев': [42.6650, 23.3450],
  Слатина: [42.6700, 23.3550],
  'Хаджи Димитър': [42.6980, 23.3550],
  Подуяне: [42.7050, 23.3600],
  Левски: [42.7000, 23.3500],
  Лозенец: [42.6720, 23.3250],
  'Кръстова вада': [42.6580, 23.3150],
  'Манастирски ливади': [42.6550, 23.3000],
  Стрелбище: [42.6720, 23.2950],
  Мотописта: [42.6580, 23.2900],
  'Малинова долина': [42.6480, 23.2950],
  Витоша: [42.6350, 23.2850],
  Павлово: [42.6650, 23.2750],
  'Горна баня': [42.6700, 23.2450],
  Княжево: [42.6600, 23.2600],
  Бояна: [42.6450, 23.2700],
  Драгалевци: [42.6250, 23.3050],
  Симеоново: [42.6100, 23.3300],
  'Овча купел': [42.6850, 23.2650],
  'Красна поляна': [42.7000, 23.2700],
  'Западен парк': [42.7050, 23.2600],
  Банкя: [42.7000, 23.1500],
  Филиповци: [42.7200, 23.2350],
  Суходол: [42.7100, 23.2200],
  'Модерно предградие': [42.6850, 23.2500],
}

const EARTH_RADIUS_M = 111_320

// Random point within `radiusMeters` of `center`, uniform over the disc
// (sqrt on the radius draw avoids bunching near the center).
function jitter([lat, lng]: [number, number], radiusMeters: number): [number, number] {
  const angle = Math.random() * 2 * Math.PI
  const radius = Math.sqrt(Math.random()) * radiusMeters
  const dLat = (radius * Math.cos(angle)) / EARTH_RADIUS_M
  const dLng = (radius * Math.sin(angle)) / (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180))
  return [lat + dLat, lng + dLng]
}

const MATCHED_JITTER_M = 150
const UNMATCHED_JITTER_M = 800

// Strips the "град София, " prefix imot.bg puts in front of every Sofia
// district name, leaving just the district for the lookup table above.
export function normalizeDistrictName(rawDistrict: string): string {
  return rawDistrict.replace(/^град София,\s*/u, '').trim()
}

export function geocodeDistrict(
  rawDistrict: string,
  sofiaCenter: [number, number],
): { lat: number; lng: number } {
  const district = normalizeDistrictName(rawDistrict)
  const centroid = SOFIA_DISTRICT_CENTROIDS[district]
  const [lat, lng] = centroid
    ? jitter(centroid, MATCHED_JITTER_M)
    : jitter(sofiaCenter, UNMATCHED_JITTER_M)
  return { lat, lng }
}
