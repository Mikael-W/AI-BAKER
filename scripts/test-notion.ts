import { getStock, getCatalogue, getVentes } from "../src/lib/notion.ts";

async function main() {
  const stock = await getStock();
  console.log(`\n📦 STOCK — ${stock.length} ingrédients`);
  for (const item of stock) {
    const alerte = item.sousSeuil ? "  ⚠️ SOUS SEUIL" : "";
    console.log(
      `  - ${item.ingredient}: ${item.quantiteEnStock} ${item.unite} ` +
        `(seuil ${item.seuilAlerte}) — ${item.fournisseur}${alerte}`,
    );
  }

  const catalogue = await getCatalogue();
  console.log(`\n🥖 CATALOGUE — ${catalogue.length} produits`);
  for (const item of catalogue) {
    console.log(
      `  - ${item.produit} (${item.categorie}): ` +
        `${item.prixVenteTTC}€ / coût ${item.coutRevient}€ / marge ${item.margePourcent}%`,
    );
  }

  const ventes = await getVentes();
  const totalCA = ventes.reduce((sum, v) => sum + (v.ca ?? 0), 0);
  const periode =
    ventes.length > 0
      ? `${ventes[0].date} → ${ventes[ventes.length - 1].date}`
      : "—";
  console.log(`\n📊 VENTES — ${ventes.length} lignes (${periode})`);
  console.log(`  CA total sur la période: ${totalCA.toFixed(2)}€`);

  const croissants = await getVentes({ produit: "Croissant pur beurre" });
  const totalCroissants = croissants.reduce(
    (sum, v) => sum + (v.quantiteVendue ?? 0),
    0,
  );
  console.log(
    `  Filtre "Croissant pur beurre": ${croissants.length} jours, ` +
      `${totalCroissants} vendus`,
  );
}

main().catch((error) => {
  console.error("❌ Erreur:", error.message);
  process.exit(1);
});
