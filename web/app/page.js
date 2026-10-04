import DatePicker from "./date-picker";

const SUPERMARKETS = { ab: "ΑΒ", galaxias: "Γαλαξίας", kritikos: "Κρητικός" };
const euro = (value) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value);
const dmy = (date) => date.split("-").reverse().join("/");
const longDate = (date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

async function get(path) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) throw new Error(`Supabase said ${response.status}: ${await response.text()}`);
  return response.json();
}

async function loadData(requested) {
  const [products, competitors, first, last] = await Promise.all([
    get("products?select=id,name,brand&order=id"),
    get("competitors?select=product_id,competitor_id&status=eq.approved"),
    get("prices?select=date&order=date.asc&limit=1"),
    get("prices?select=date&order=date.desc&limit=1"),
  ]);
  // The date from the URL (?date=2026-10-04), otherwise the most recent day with prices.
  // Checking the format also keeps anything else out of the Supabase URL.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? "") ? requested : last[0]?.date;
  if (!date) return {};

  const columns = "product_id,supermarket,price_paid,regular_price,offer_text,offer_start,offer_end,source_url";
  const [prices, before, after] = await Promise.all([
    get(`prices?select=${columns}&date=eq.${date}`),
    get(`prices?select=date&date=lt.${date}&order=date.desc&limit=1`),
    get(`prices?select=date&date=gt.${date}&order=date.asc&limit=1`),
  ]);
  return {
    products,
    competitors,
    prices,
    dates: { date, earliest: first[0].date, latest: last[0].date, previous: before[0]?.date, next: after[0]?.date },
  };
}

function offerDetails(row) {
  const text = row.offer_text ?? "Reduced price";
  if (row.offer_start && row.offer_end) return `${text} (${dmy(row.offer_start)} to ${dmy(row.offer_end)})`;
  if (row.offer_end) return `${text} (until ${dmy(row.offer_end)})`;
  return text;
}

// Shows its text on hover, or on tap/keyboard focus thanks to tabIndex.
function Tip({ icon, text }) {
  return (
    <span className="tip" tabIndex={0}>
      {icon}
      <span className="tip-text">{text}</span>
    </span>
  );
}

// 🏷️ for a real price cut, ⓘ for a shop label that does not change the price.
function PriceCell({ row, highlight }) {
  if (!row) return <td className="price none">—</td>;
  const reduced = row.price_paid < row.regular_price;
  return (
    <td className="price">
      <a href={row.source_url} className={highlight ? "cheapest" : undefined}>{euro(row.price_paid)}</a>
      {reduced && <span className="was">{euro(row.regular_price)}</span>}
      {reduced ? <Tip icon="🏷️" text={offerDetails(row)} /> : row.offer_text && <Tip icon="ⓘ" text={offerDetails(row)} />}
    </td>
  );
}

export default async function Page({ searchParams }) {
  const { date: requested } = await searchParams;
  const { products, competitors, prices, dates } = await loadData(requested);
  if (!dates) return <main>No prices yet.</main>;

  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const priceOf = (productId, shop) => prices.find((r) => r.product_id === productId && r.supermarket === shop);
  // Each MEVGAL product followed by its approved competitors.
  const groups = products
    .filter((p) => p.brand === "ΜΕΒΓΑΛ")
    .map((p) => [p, ...competitors.filter((c) => c.product_id === p.id).map((c) => byId[c.competitor_id])]);
  // Cheapest price in a group at one supermarket, only when there is something to compare.
  const cheapest = (group, shop) => {
    const paid = group.map((p) => priceOf(p.id, shop)?.price_paid).filter((v) => v != null);
    return paid.length > 1 ? Math.min(...paid) : null;
  };

  return (
    <main>
      <header>
        <div>
          <h1>MEVGAL prices</h1>
          <p className="subtitle">Supermarket e-shop prices on {longDate(dates.date)}</p>
        </div>
        <DatePicker {...dates} />
      </header>

      <div className="card">
        {prices.length === 0 ? (
          <p className="empty">No prices saved for this day.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                {Object.values(SUPERMARKETS).map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                group.map((p, i) => (
                  <tr key={`${group[0].id}-${p.id}`} className={i === 0 ? "mevgal" : "competitor"}>
                    <td>{p.name}</td>
                    {Object.keys(SUPERMARKETS).map((shop) => {
                      const row = priceOf(p.id, shop);
                      return (
                        <PriceCell key={shop} row={row} highlight={row && row.price_paid === cheapest(group, shop)} />
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <ul className="legend">
        <li>Green: cheapest in its group at that supermarket</li>
        <li>🏷️ Reduced price (hover for the offer)</li>
        <li>ⓘ Shop label without a price cut (hover for details)</li>
      </ul>
    </main>
  );
}
