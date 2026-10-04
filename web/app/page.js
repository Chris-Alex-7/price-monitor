// Fetch fresh prices on every visit instead of freezing them at build time.
export const dynamic = "force-dynamic";

const SUPERMARKETS = { ab: "ΑΒ", galaxias: "Γαλαξίας", kritikos: "Κρητικός" };
const euro = (value) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value);
const cell = { padding: "6px 8px", borderBottom: "1px solid #eee", textAlign: "left" };

async function get(path) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) throw new Error(`Supabase said ${response.status}: ${await response.text()}`);
  return response.json();
}

async function loadData() {
  const [products, competitors, latest] = await Promise.all([
    get("products?select=id,name,brand&order=id"),
    get("competitors?select=product_id,competitor_id&status=eq.approved"),
    get("prices?select=date&order=date.desc&limit=1"),
  ]);
  // Only the most recent day, so the page still shows something before today's run.
  const date = latest[0]?.date;
  const columns = "product_id,supermarket,price_paid,regular_price,offer_text,offer_start,offer_end,source_url";
  const prices = date ? await get(`prices?select=${columns}&date=eq.${date}`) : [];
  return { products, competitors, date, prices };
}

function offerDetails(row) {
  if (row.offer_start && row.offer_end) return `${row.offer_text} (${row.offer_start} to ${row.offer_end})`;
  if (row.offer_end) return `${row.offer_text} (until ${row.offer_end})`;
  return row.offer_text;
}

function PriceCell({ row, highlight }) {
  if (!row) return <td style={{ ...cell, color: "#aaa" }}>—</td>;
  const reduced = row.price_paid < row.regular_price;
  return (
    <td style={{ ...cell, whiteSpace: "nowrap", background: highlight ? "#d4f7d4" : "transparent" }}>
      <a href={row.source_url} style={{ color: "inherit" }}>{euro(row.price_paid)}</a>
      {reduced && <s style={{ color: "#888", fontSize: "0.8em", marginLeft: 4 }}>{euro(row.regular_price)}</s>}
      {reduced && " 🏷️"}
      {row.offer_text && <span title={offerDetails(row)} style={{ cursor: "help", marginLeft: 4 }}>ⓘ</span>}
    </td>
  );
}

export default async function Page() {
  const { products, competitors, date, prices } = await loadData();
  if (!date) return <p>No prices yet.</p>;

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
      <h1>MEVGAL prices</h1>
      <p>
        Prices for {date}. Green is the cheapest in its group at that supermarket. 🏷️ means a reduced price; hover ⓘ
        for offer details.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cell}>Product</th>
            {Object.values(SUPERMARKETS).map((name) => (
              <th key={name} style={cell}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) =>
            group.map((p, i) => (
              <tr key={`${group[0].id}-${p.id}`}>
                <td style={{ ...cell, fontWeight: i === 0 ? "bold" : "normal", paddingLeft: i === 0 ? 8 : 28 }}>
                  {p.name}
                </td>
                {Object.keys(SUPERMARKETS).map((shop) => {
                  const row = priceOf(p.id, shop);
                  return <PriceCell key={shop} row={row} highlight={row && row.price_paid === cheapest(group, shop)} />;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
