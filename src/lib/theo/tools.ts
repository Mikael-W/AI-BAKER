import { tool } from "ai";
import { z } from "zod";
import { getStock, getCatalogue, getVentes } from "@/lib/notion";

const consulterStock = tool({
  description:
    "Consulte le stock d'ingrédients de la boulangerie (quantités, unités, " +
    "seuils d'alerte, fournisseurs, prix). À utiliser pour répondre à 'il me " +
    "reste combien de X ?', 'qu'est-ce qui est sous le seuil ?', 'faut-il commander ?'.",
  inputSchema: z.object({
    ingredient: z
      .string()
      .optional()
      .describe("Nom (même partiel) d'un ingrédient pour filtrer, ex. 'beurre'"),
    seulementSousSeuil: z
      .boolean()
      .optional()
      .describe("Ne renvoyer que les ingrédients sous leur seuil d'alerte"),
  }),
  execute: async ({ ingredient, seulementSousSeuil }) => {
    let stock = await getStock();
    if (ingredient) {
      const needle = ingredient.toLowerCase();
      stock = stock.filter((item) =>
        item.ingredient.toLowerCase().includes(needle),
      );
    }
    if (seulementSousSeuil) {
      stock = stock.filter((item) => item.sousSeuil);
    }
    return stock;
  },
});

const consulterCatalogue = tool({
  description:
    "Consulte le catalogue des produits vendus (prix de vente, coût de revient, " +
    "marge, catégorie, temps de préparation, ingrédients). À utiliser pour les " +
    "questions de prix, de marge ou de rentabilité d'un produit.",
  inputSchema: z.object({
    produit: z
      .string()
      .optional()
      .describe("Nom (même partiel) d'un produit pour filtrer, ex. 'éclair'"),
    categorie: z
      .enum(["Pain", "Viennoiserie", "Pâtisserie", "Snacking"])
      .optional()
      .describe("Filtrer par catégorie de produit"),
  }),
  execute: async ({ produit, categorie }) => {
    let catalogue = await getCatalogue();
    if (produit) {
      const needle = produit.toLowerCase();
      catalogue = catalogue.filter((item) =>
        item.produit.toLowerCase().includes(needle),
      );
    }
    if (categorie) {
      catalogue = catalogue.filter((item) => item.categorie === categorie);
    }
    return catalogue;
  },
});

const consulterVentes = tool({
  description:
    "Analyse l'historique des ventes quotidiennes. Renvoie un résumé chiffré " +
    "(total vendu, chiffre d'affaires, détail par produit) sur la période " +
    "demandée. À utiliser pour 'combien j'ai vendu de X ?', les tendances, " +
    "les comparaisons, ou pour préparer une prévision.",
  inputSchema: z.object({
    produit: z
      .string()
      .optional()
      .describe("Nom exact du produit pour ne garder que ses ventes"),
    depuis: z
      .string()
      .optional()
      .describe("Date de début au format AAAA-MM-JJ"),
    jusqua: z
      .string()
      .optional()
      .describe("Date de fin au format AAAA-MM-JJ"),
  }),
  execute: async ({ produit, depuis, jusqua }) => {
    const ventes = await getVentes({ produit, depuis, jusqua });

    if (ventes.length === 0) {
      return { lignes: 0, message: "Aucune vente sur cette période." };
    }

    const dates = ventes.map((v) => v.date ?? "").filter(Boolean).sort();
    const totalQuantite = ventes.reduce(
      (sum, v) => sum + (v.quantiteVendue ?? 0),
      0,
    );
    const totalCA = ventes.reduce((sum, v) => sum + (v.ca ?? 0), 0);

    const parProduit: Record<
      string,
      { quantite: number; ca: number }
    > = {};
    for (const vente of ventes) {
      const nom = vente.produit ?? "Inconnu";
      parProduit[nom] ??= { quantite: 0, ca: 0 };
      parProduit[nom].quantite += vente.quantiteVendue ?? 0;
      parProduit[nom].ca += vente.ca ?? 0;
    }

    return {
      periode: { debut: dates[0], fin: dates[dates.length - 1] },
      totalQuantiteVendue: totalQuantite,
      chiffreAffaires: Math.round(totalCA * 100) / 100,
      parProduit,
    };
  },
});

export const theoTools = {
  consulterStock,
  consulterCatalogue,
  consulterVentes,
};
