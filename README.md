# price-monitor

Daily dairy product price and offer monitoring.

## The question

> Every morning, how does each product's price compare to its
> competitors at each supermarket, and who is on offer?

Anything that doesn't help answer this question is out of scope.

## Scope (first milestone)

**Product:** ΜΕΒΓΑΛ Κεφίρ 500ml

**Competitors:** ΟΛΥΜΠΟΣ Κεφίρ 500ml, ΡΟΔΟΠΗ Κεφίρ 500ml, ΕΒΡΟΦΑΡΜΑ Κεφίρ 500ml

**Supermarkets (e-shops only):** Σκλαβενίτης, My Market, Κρητικός, Μασούτης,
ΑΒ Βασιλόπουλος, Γαλαξίας, Χαλκιαδάκης, Bazaar, Market In

That is 4 products × 9 supermarkets = 36 prices per day.

## How it works

```text
COLLECT  →  STORE RAW  →  CLEAN & MATCH  →  SHOW
(daily      (Supabase      (Python)          (Next.js
 GitHub      Storage)                         on Vercel)
 Actions)
```

1. **Collect** — one small script per supermarket downloads today's data.
2. **Store raw** — the download is saved exactly as received, so it can be re-read later.
3. **Clean & match** — raw data becomes tidy price rows for the products we track.
4. **Show** — the website only reads the tidy tables.

## Rules we follow

- Products are matched to each supermarket once, by a person, never guessed by name.
- Every price row records its source.
- Running a day again replaces that day's rows; it never duplicates them.
- Secrets live in environment variables, never in git.
- If we can't explain a piece of code, it doesn't get merged.
