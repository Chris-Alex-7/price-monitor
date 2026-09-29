// Fetch fresh prices on every visit instead of freezing them at build time.
export const dynamic = "force-dynamic";

const SUPERMARKETS = { ab: "ΑΒ Βασιλόπουλος", galaxias: "Γαλαξίας", kritikos: "Κρητικός" };
const euro = (value) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value);

async function latestPrices() {
  const columns = "date,supermarket,product,price_paid,regular_price,offer_text,offer_end,source_url";
  const url = `${process.env.SUPABASE_URL}/rest/v1/prices?select=${columns}&order=date.desc&limit=200`;
  const response = await fetch(url, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) throw new Error(`Supabase said ${response.status}: ${await response.text()}`);
  const rows = await response.json();
  // Only the most recent day, so the page still shows something before today's run.
  return rows.filter((r) => r.date === rows[0]?.date);
}

export default async function Page() {
  const rows = await latestPrices();
  if (rows.length === 0) return <p>No prices yet.</p>;

  return (
    <main>
      <h1>Κεφίρ 500ml prices</h1>
      <p>Prices for {rows[0].date}. The cheapest at each supermarket is highlighted.</p>

      {Object.entries(SUPERMARKETS).map(([key, name]) => {
        const shop = rows.filter((r) => r.supermarket === key).sort((a, b) => a.price_paid - b.price_paid);
        if (shop.length === 0) return null;
        const cheapest = shop[0].price_paid;

        return (
          <section key={key}>
            <h2>{name}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Regular</th>
                  <th>Offer</th>
                </tr>
              </thead>
              <tbody>
                {shop.map((r) => (
                  <tr key={r.product} style={{ background: r.price_paid === cheapest ? "#d4f7d4" : "transparent" }}>
                    <td style={{ padding: 6 }}>
                      <a href={r.source_url}>{r.product}</a>
                    </td>
                    <td style={{ padding: 6, fontWeight: "bold" }}>{euro(r.price_paid)}</td>
                    <td style={{ padding: 6 }}>
                      {r.price_paid < r.regular_price ? <s>{euro(r.regular_price)}</s> : euro(r.regular_price)}
                    </td>
                    <td style={{ padding: 6 }}>
                      {r.offer_text ? `${r.offer_text}${r.offer_end ? ` (until ${r.offer_end})` : ""}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
