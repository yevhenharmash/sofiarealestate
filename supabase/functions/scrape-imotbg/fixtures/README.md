Real imot.bg pages, saved for offline parser verification (see the comment
block at the top of `../index.ts`):

- `list-page.html` — `/obiavi/naemi/grad-sofiya` (page 1)
- `detail-page.html` — `obiava-2b178608183757853-...` (the listing referenced
  in `.cursor/plans/imotbg-import.plan.md`)

If imot.bg changes its markup and the scraper starts missing fields, refetch
fresh copies of both page types and diff against these before touching the
selectors in `index.ts`.
