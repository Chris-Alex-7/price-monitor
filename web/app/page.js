import { CategoryFilter, DatePicker } from "./controls";

const SUPERMARKETS = { ab: "ΑΒ", galaxias: "Γαλαξίας", kritikos: "Κρητικός" };
const euro = (value) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value);
const dmy = (date) => date.split("-").reverse().join("/");
const longDate = (date) =>
  new Intl.DateTimeFormat("el-GR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
// "en-CA" writes dates as YYYY-MM-DD, the same format as the database.
const greekToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());

async function get(path) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) throw new Error(`Supabase said ${response.status}: ${await response.text()}`);
  return response.json();
}

async function loadData(requested) {
  const [categories, products, competitors, first, last] = await Promise.all([
    get("categories?select=id,name&order=id"),
    get("products?select=id,name,brand,category_id&order=id"),
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
    categories,
    products,
    competitors,
    prices,
    dates: { date, earliest: first[0].date, latest: last[0].date, previous: before[0]?.date, next: after[0]?.date },
  };
}

function offerDetails(row) {
  const text = row.offer_text ?? "Μειωμένη τιμή";
  if (row.offer_start && row.offer_end) return `${text} (${dmy(row.offer_start)} έως ${dmy(row.offer_end)})`;
  if (row.offer_end) return `${text} (έως ${dmy(row.offer_end)})`;
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
  const { date: requested, categories: picked } = await searchParams;
  const { categories, products, competitors, prices, dates } = await loadData(requested);
  if (!dates) return <main>Δεν υπάρχουν ακόμη τιμές.</main>;
  const today = greekToday();

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

  // One section per category that has products, in the categories' id order.
  const sections = categories
    .map((c) => ({ ...c, groups: groups.filter((group) => group[0].category_id === c.id) }))
    .filter((s) => s.groups.length > 0);
  // ?categories=2,6 -> [2, 6]. Unknown ids are dropped; none left means "All".
  const selected = String(picked ?? "").split(",").map(Number).filter((id) => sections.some((s) => s.id === id));
  const shown = selected.length ? sections.filter((s) => selected.includes(s.id)) : sections;

  return (
    <main>
      <header>
        <div>
          <h1>Τιμές ΜΕΒΓΑΛ</h1>
          <p className="subtitle">Τιμές e-shop σούπερ μάρκετ, {longDate(dates.date)}</p>
        </div>
        <div className="controls">
          <CategoryFilter options={sections.map(({ id, name }) => ({ id, name }))} selected={selected} date={dates.date} />
          <DatePicker {...dates} today={today} categories={selected} />
        </div>
      </header>

      <div className="card">
        {prices.length === 0 ? (
          <p className="empty">
            {dates.date === today
              ? "Οι σημερινές τιμές δεν έχουν συλλεχθεί ακόμη. Συλλέγονται νωρίς κάθε πρωί."
              : "Δεν υπάρχουν αποθηκευμένες τιμές για αυτή την ημέρα."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Προϊόν</th>
                {Object.values(SUPERMARKETS).map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            {shown.map((section) => (
              <tbody key={section.id}>
                <tr className="category">
                  <td colSpan={1 + Object.keys(SUPERMARKETS).length}>{section.name}</td>
                </tr>
                {section.groups.map((group) =>
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
            ))}
          </table>
        )}
      </div>

      <ul className="legend">
        <li>Πράσινο: η φθηνότερη τιμή της ομάδας σε κάθε σούπερ μάρκετ</li>
        <li>🏷️ Μειωμένη τιμή (περάστε το ποντίκι από πάνω για την προσφορά)</li>
        <li>ⓘ Ένδειξη του καταστήματος χωρίς μείωση τιμής (περάστε το ποντίκι από πάνω για λεπτομέρειες)</li>
      </ul>
    </main>
  );
}
