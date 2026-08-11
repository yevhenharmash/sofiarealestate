// Crawls imot.bg's Sofia rental listings and upserts them into `listings`
// via the upsert_scraped_listing RPC. See
// .cursor/plans/imotbg-import.plan.md for the full design, and
// sofia-districts.ts for the geocoding fallback table.
//
// Selectors below were verified against live fixtures (a list page and the
// obiava-2b178608183757853 detail page referenced in the plan), not guessed:
// - list item: div.item, title+district: .zaglavie a.title (nested <location>
//   holds the district, everything else in the anchor's own text is the title)
// - price: .price div, must contain "€" (imot.bg also lists BGN-only ads)
// - phone: only reliably unambiguous in .contactsBox .phone (the sidebar
//   summary box) -- the description form also has an unrelated ".phone"
//   field for the *enquirer's* number, which has no digits in the markup
// - images: .owl-carousel img[data-src] (the full-size gallery, scoped to
//   this listing -- avoids stray thumbnails from a "similar listings" widget
//   elsewhere on the page)
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as cheerio from 'npm:cheerio@1'
import { geocodeDistrict } from './sofia-districts.ts'

const BASE_URL = 'https://www.imot.bg'
const LIST_URL = `${BASE_URL}/obiavi/naemi/grad-sofiya`
const PAGES_PER_RUN = 5
const REQUEST_DELAY_MS = 1000
const USER_AGENT = 'Mozilla/5.0 (compatible; ImaimotiBot/0.1; +mailto:yevhen@trykiroku.com)'
// Mirrors src/lib/constants.ts -- edge functions can't import from src/.
const SOFIA_CENTER: [number, number] = [42.6977, 23.3219]
const MAX_LISTING_IMAGES = 6

type ListingType = 'room' | 'flat' | 'house'

interface ListItem {
  sourceUrl: string
  title: string
  district: string
  price: number
}

interface DetailFields {
  description: string | null
  phone: string | null
  images: string[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function absoluteUrl(href: string): string {
  return href.startsWith('//') ? `https:${href}` : href
}

async function fetchDecoded(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = await res.arrayBuffer()
  return new TextDecoder('windows-1251').decode(buf)
}

function parseListPage(html: string): ListItem[] {
  const $ = cheerio.load(html)
  const items: ListItem[] = []

  $('div.item').each((_, el) => {
    const titleAnchor = $(el).find('.zaglavie a.title').first()
    const href = titleAnchor.attr('href')
    if (!href) return

    const district = titleAnchor.find('location').text().trim()
    const title = titleAnchor.clone().find('location').remove().end().text().trim()

    const priceText = $(el).find('.price div').first().text().trim()
    if (!priceText.includes('€')) return // skip BGN-only / price-on-request ads

    const price = Number(priceText.replace(/[^\d]/g, ''))
    if (!price) return

    items.push({ sourceUrl: absoluteUrl(href), title, district, price })
  })

  return items
}

function parseDetailPage(html: string): DetailFields {
  const $ = cheerio.load(html)

  const description = $('.moreInfo .text').first().text().trim() || null

  const phoneMatch = $('.contactsBox .phone').first().text().match(/0\d[\d\s]{6,}\d/)
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : null

  const images = [
    ...new Set(
      $('.owl-carousel img[data-src]')
        .map((_, img) => $(img).attr('data-src'))
        .get()
        .filter((src): src is string => !!src),
    ),
  ].slice(0, MAX_LISTING_IMAGES)

  return { description, phone, images }
}

function classifyType(title: string): ListingType {
  if (/къща|вила/iu.test(title)) return 'house'
  if (/\bстая\b|\bстаи\b/iu.test(title)) return 'room'
  if (/стаен|гарсониера/iu.test(title)) return 'flat'
  console.warn(`Unmatched listing type, defaulting to 'flat': "${title}"`)
  return 'flat'
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function getNextPage(): Promise<number> {
  const { data, error } = await supabase
    .from('imotbg_scrape_state')
    .select('next_page')
    .single()
  if (error) throw error
  return data.next_page
}

async function setNextPage(page: number): Promise<void> {
  const { error } = await supabase
    .from('imotbg_scrape_state')
    .update({ next_page: page, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw error
}

async function findExistingUrls(sourceUrls: string[]): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('listings')
    .select('source_url')
    .in('source_url', sourceUrls)
  if (error) throw error
  return new Set(data.map((row) => row.source_url as string))
}

async function upsertListing(
  item: ListItem,
  detail: DetailFields | null,
): Promise<{ error: string | null }> {
  const { lat, lng } = geocodeDistrict(item.district, SOFIA_CENTER)

  const { error } = await supabase.rpc('upsert_scraped_listing', {
    p_source_url: item.sourceUrl,
    p_title: item.title,
    p_description: detail?.description ?? null,
    p_price: item.price,
    p_type: classifyType(item.title),
    p_phone: detail?.phone ?? '',
    p_images: detail?.images ?? [],
    p_lat: lat,
    p_lng: lng,
    p_location_precision: 'approximate',
  })

  return { error: error?.message ?? null }
}

Deno.serve(async () => {
  const startPage = await getNextPage()
  let page = startPage
  let wrapped = false
  let processed = 0
  let created = 0
  let skipped = 0

  for (let i = 0; i < PAGES_PER_RUN; i++) {
    const url = page === 1 ? LIST_URL : `${LIST_URL}/p-${page}`
    let html: string
    try {
      html = await fetchDecoded(url)
    } catch (err) {
      console.error(`Failed to fetch list page ${page}: ${err}`)
      break
    }

    const items = parseListPage(html)
    if (items.length === 0) {
      // Past the last page -- wrap around and treat this as a full-cycle boundary.
      wrapped = true
      break
    }

    const existingUrls = await findExistingUrls(items.map((item) => item.sourceUrl))

    for (const item of items) {
      processed++
      const isNew = !existingUrls.has(item.sourceUrl)
      let detail: DetailFields | null = null

      if (isNew) {
        await sleep(REQUEST_DELAY_MS)
        try {
          detail = parseDetailPage(await fetchDecoded(item.sourceUrl))
        } catch (err) {
          console.error(`Failed to fetch detail page ${item.sourceUrl}: ${err}`)
          skipped++
          continue
        }
        if (!detail.phone) {
          console.warn(`No phone found for new listing ${item.sourceUrl}, skipping`)
          skipped++
          continue
        }
      }

      const { error } = await upsertListing(item, detail)
      if (error) {
        console.error(`Failed to upsert ${item.sourceUrl}: ${error}`)
        skipped++
        continue
      }
      if (isNew) created++
    }

    page++
    await setNextPage(page)
    if (i < PAGES_PER_RUN - 1) await sleep(REQUEST_DELAY_MS)
  }

  if (wrapped) {
    page = 1
    await setNextPage(page)
    const { error } = await supabase.rpc('expire_stale_imotbg_listings')
    if (error) console.error(`Failed to expire stale listings: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ startPage, endPage: page, processed, created, skipped, wrapped }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
