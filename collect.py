"""Fetch today's prices for the products in products.json and print a table."""

import json
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from zoneinfo import ZoneInfo

AB_URL = "https://www.ab.gr/api/v1/"
AB_QUERY = """
query productByCode($code: String) {
  categoryProductSearchV2(lang: "gr", category: "", pageSize: 50, pageNumber: 0,
      searchQuery: $code, sort: "relevance", filterFlag: true, plainChildCategories: true) {
    products {
      code name manufacturerName url stock { inStock }
      price { value discountedPriceFormatted supplementaryPriceLabel1 wasPrice }
      potentialPromotions { description promotionType fromDate endDate simplePromotionMessage }
    }
  }
}
"""

GALAXIAS_URL = "https://magento2.galaxias.shop/graphql"
GALAXIAS_QUERY = """
query productsBySku($skus: [String]) {
  products(filter: { sku: { in: $skus } }, pageSize: 100) {
    items {
      sku name url_key stock_status
      price_range { minimum_price { regular_price { value } } }
      catalog_rules { name promoType action_name actions { amount } from to tags }
    }
  }
}
"""
# Γαλαξίας blocks Python's default identity. We use a plain name, not a fake browser.
GALAXIAS_HEADERS = {"user-agent": "price-monitor/0.1"}


def post_json(url, payload, headers):
    time.sleep(1)  # be polite: about 1 request per second
    body = json.dumps(payload).encode()
    headers = {"content-type": "application/json", **headers}
    request = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def ab_date(text, default_year):
    """'24/09', '24/09/26' or '07/10/2026 20:59:00' -> date."""
    parts = text.split()[0].split("/")
    year = int(parts[2]) if len(parts) > 2 else default_year
    if year < 100:
        year += 2000
    return date(year, int(parts[1]), int(parts[0]))


def fetch_ab(product, code, today):
    payload = {"operationName": "productByCode", "query": AB_QUERY, "variables": {"code": code}}
    headers = {"apollo-require-preflight": "true", "x-apollo-operation-name": "productByCode"}
    data = post_json(AB_URL, payload, headers)
    matches = [p for p in data["data"]["categoryProductSearchV2"]["products"] if p["code"] == code]
    if not matches:
        print(f"WARNING: ΑΒ code {code} ({product}) not found")
        return None
    raw = matches[0]

    # A "Μόνο" label with no dates is a permanent shelf label, not an offer.
    promos = [
        p for p in raw["potentialPromotions"]
        if not (p["description"] == "Μόνο" and not p["fromDate"] and not p["endDate"])
    ]
    offer_start = offer_end = None
    if promos and promos[0]["endDate"]:
        offer_end = ab_date(promos[0]["endDate"], today.year)
        if promos[0]["fromDate"]:
            offer_start = ab_date(promos[0]["fromDate"], offer_end.year)
            if offer_start > offer_end:  # start date had no year and is in the previous year
                offer_start = offer_start.replace(year=offer_start.year - 1)

    return {
        "date": today,
        "supermarket": "ab",
        "product": product,
        "price_paid": float(raw["price"]["discountedPriceFormatted"].replace("€", "").replace(",", ".")),
        "regular_price": raw["price"]["value"],
        "offer_text": " | ".join(p["simplePromotionMessage"] or p["description"] for p in promos) or None,
        "offer_start": offer_start,
        "offer_end": offer_end,
        "source_url": "https://www.ab.gr" + raw["url"],
        "raw": raw,
    }


def fetch_galaxias(codes, today):
    """codes is {product: barcode}. One request fetches all of them."""
    payload = {"query": GALAXIAS_QUERY, "variables": {"skus": list(codes.values())}}
    data = post_json(GALAXIAS_URL, payload, GALAXIAS_HEADERS)
    items = {p["sku"]: p for p in data["data"]["products"]["items"]}

    rows = []
    for product, sku in codes.items():
        raw = items.get(sku)
        if not raw:
            print(f"WARNING: Γαλαξίας barcode {sku} ({product}) not found")
            continue

        # The listed price is before the offer; work out the offer price ourselves.
        regular = raw["price_range"]["minimum_price"]["regular_price"]["value"]
        rules = raw["catalog_rules"] or []
        paid = regular
        for r in rules:
            amount = float(r["actions"]["amount"])
            if r["promoType"] == "bravo_bonus":  # loyalty points, the shelf price stays the same
                continue
            if r["action_name"] == "percent":
                paid -= regular * amount / 100
            elif r["action_name"] == "fixed":
                paid -= amount

        rows.append({
            "date": today,
            "supermarket": "galaxias",
            "product": product,
            "price_paid": round(paid, 2),
            "regular_price": regular,
            "offer_text": " | ".join(
                r["name"] + (" (bravo bonus)" if r["promoType"] == "bravo_bonus" else "") for r in rules
            ) or None,
            "offer_start": date.fromisoformat(rules[0]["from"][0]) if rules else None,
            "offer_end": date.fromisoformat(rules[0]["to"][0]) if rules else None,
            "source_url": "https://galaxias.shop/product/" + raw["url_key"],
            "raw": raw,
        })
    return rows


def load_env():
    """Read KEY=VALUE lines from .env into the environment (on GitHub Actions there is no .env)."""
    if not os.path.exists(".env"):
        return
    with open(".env", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def save_to_supabase(rows):
    """Upsert: a row with the same date + supermarket + product is replaced, never duplicated."""
    url = os.environ["SUPABASE_URL"] + "/rest/v1/prices?on_conflict=date,supermarket,product"
    headers = {
        "apikey": os.environ["SUPABASE_SECRET_KEY"],
        "content-type": "application/json",
        "prefer": "resolution=merge-duplicates",
    }
    body = json.dumps(rows, default=str).encode()  # default=str turns dates into "2026-09-28"
    request = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30):
            pass
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase said {e.code}: {e.read().decode()}")
    print(f"\nSaved {len(rows)} rows to Supabase.")


def main():
    load_env()
    today = datetime.now(ZoneInfo("Europe/Athens")).date()
    with open("products.json", encoding="utf-8") as f:
        config = json.load(f)

    rows = []
    for product, codes in config.items():
        if "ab" in codes:
            row = fetch_ab(product, codes["ab"], today)
            if row:
                rows.append(row)

    galaxias_codes = {product: codes["galaxias"] for product, codes in config.items() if "galaxias" in codes}
    if galaxias_codes:
        rows += fetch_galaxias(galaxias_codes, today)

    print(f"\nPrices for {today}\n")
    print(f"{'SUPERMARKET':<12} {'PRODUCT':<22} {'PAID':>6} {'REGULAR':>8}  OFFER")
    for r in rows:
        offer = r["offer_text"] or "-"
        if r["offer_start"] or r["offer_end"]:
            offer += f" ({r['offer_start']} to {r['offer_end']})"
        print(f"{r['supermarket']:<12} {r['product']:<22} {r['price_paid']:>6.2f} {r['regular_price']:>8.2f}  {offer}")

    save_to_supabase(rows)


if __name__ == "__main__":
    main()
