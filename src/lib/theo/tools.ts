import { tool } from "ai";
import { z } from "zod";
import {
  getStock,
  getCatalogue,
  getVentes,
  creerCommandeFournisseur,
} from "@/lib/notion/notion";
import { envoyerEmail } from "@/lib/email/email";
import { getMeteo, type Meteo } from "@/lib/weather/weather";

const normaliser = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

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
      .string()
      .optional()
      .describe(
        "Filtrer par catégorie, ex. Pain, Viennoiserie, Pâtisserie, Snacking",
      ),
  }),
  execute: async ({ produit, categorie }) => {
    let catalogue = await getCatalogue();
    if (produit) {
      const aiguille = normaliser(produit);
      catalogue = catalogue.filter((item) =>
        normaliser(item.produit).includes(aiguille),
      );
    }
    if (categorie) {
      const cible = normaliser(categorie);
      catalogue = catalogue.filter(
        (item) => item.categorie !== null && normaliser(item.categorie) === cible,
      );
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

const envoyerCommandeFournisseur = tool({
  description:
    "Envoie une vraie commande à un fournisseur pour un ingrédient : récupère " +
    "ses coordonnées dans le stock, envoie l'email et enregistre la commande " +
    "dans le registre. Rédige d'abord l'objet et le corps de l'email. L'envoi " +
    "déclenchera une demande de confirmation à Madeleine : il ne part que si " +
    "elle valide.",
  needsApproval: true,
  inputSchema: z.object({
    ingredient: z
      .string()
      .describe("Nom de l'ingrédient à commander, ex. 'Farine T65'"),
    quantite: z
      .number()
      .describe("Quantité à commander, dans l'unité de l'ingrédient"),
    objet: z.string().describe("Objet de l'email envoyé au fournisseur"),
    corps: z.string().describe("Corps de l'email, rédigé pour le fournisseur"),
  }),
  execute: async ({ ingredient, quantite, objet, corps }) => {
    const stock = await getStock();
    const needle = ingredient.toLowerCase();
    const item =
      stock.find((entry) => entry.ingredient.toLowerCase() === needle) ??
      stock.find((entry) => entry.ingredient.toLowerCase().includes(needle));

    if (!item) {
      return {
        succes: false,
        erreur: `Ingrédient "${ingredient}" introuvable dans le stock.`,
      };
    }
    if (!item.fournisseur || !item.emailFournisseur) {
      return {
        succes: false,
        erreur: `Aucun fournisseur ou email enregistré pour ${item.ingredient}.`,
      };
    }

    const montantEstime =
      item.prixUnitaire !== null
        ? Math.round(item.prixUnitaire * quantite * 100) / 100
        : null;
    const date = new Date().toISOString().slice(0, 10);
    const reference = `CMD-${date}-${item.ingredient.replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}`;
    const produitsCommandes = `${quantite} ${item.unite ?? ""} ${item.ingredient}`.trim();

    await envoyerEmail({ destinataire: item.emailFournisseur, objet, corps });

    await creerCommandeFournisseur({
      reference,
      fournisseur: item.fournisseur,
      date,
      produitsCommandes,
      montantEstime,
      emailDestinataire: item.emailFournisseur,
      statut: "Envoyée",
    });

    return {
      succes: true,
      reference,
      fournisseur: item.fournisseur,
      destinataire: item.emailFournisseur,
      produitsCommandes,
      montantEstime,
      statut: "Envoyée",
    };
  },
});

type ArticleAntiGaspi =
  | { produit: string; introuvable: true }
  | {
      produit: string;
      categorie: string | null;
      quantite: number;
      prixNormal: number;
      prixRemise: number;
      margeRestanteUnitaire: number;
      remiseLimiteeParCout: boolean;
    };

const planAntiGaspi = tool({
  description:
    "Construit un plan anti-gaspillage pour des produits invendus en fin de " +
    "journée. Calcule une remise qui reste rentable (jamais en dessous du coût " +
    "de revient), chiffre la recette récupérée vs le plein tarif, et propose un " +
    "panier surprise. À utiliser quand Madeleine veut écouler des invendus. " +
    "Sers-toi des chiffres renvoyés pour rédiger ensuite une promo ou un post " +
    "réseaux sociaux dans la voix de Madeleine.",
  inputSchema: z.object({
    invendus: z
      .array(
        z.object({
          produit: z.string().describe("Nom du produit invendu"),
          quantite: z.number().describe("Quantité restante invendue"),
        }),
      )
      .describe("Liste des produits invendus à écouler"),
    remisePct: z
      .number()
      .optional()
      .describe("Remise souhaitée en pourcentage (défaut 30)"),
  }),
  execute: async ({ invendus, remisePct }) => {
    const remise = remisePct ?? 30;
    const catalogue = await getCatalogue();
    const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

    const articles: ArticleAntiGaspi[] = invendus.map((ligne) => {
      const needle = ligne.produit.toLowerCase();
      const produit =
        catalogue.find((entry) => entry.produit.toLowerCase() === needle) ??
        catalogue.find((entry) => entry.produit.toLowerCase().includes(needle));

      if (!produit || produit.prixVenteTTC === null) {
        return { produit: ligne.produit, introuvable: true };
      }

      const cout = produit.coutRevient ?? 0;
      const prixVoulu = arrondi(produit.prixVenteTTC * (1 - remise / 100));
      const remiseLimiteeParCout = prixVoulu < cout;
      const prixRemise = remiseLimiteeParCout ? arrondi(cout) : prixVoulu;

      return {
        produit: produit.produit,
        categorie: produit.categorie,
        quantite: ligne.quantite,
        prixNormal: produit.prixVenteTTC,
        prixRemise,
        margeRestanteUnitaire: arrondi(prixRemise - cout),
        remiseLimiteeParCout,
      };
    });

    const valides = articles.filter(
      (article): article is Extract<ArticleAntiGaspi, { prixNormal: number }> =>
        !("introuvable" in article),
    );

    const valeurSiVenduPleinTarif = arrondi(
      valides.reduce((total, a) => total + a.prixNormal * a.quantite, 0),
    );
    const recetteEstimee = arrondi(
      valides.reduce((total, a) => total + a.prixRemise * a.quantite, 0),
    );

    const panierSurprise =
      valides.length > 1
        ? {
            contenu: valides.map((a) => `${a.quantite} ${a.produit}`).join(", "),
            prixSuggere: recetteEstimee,
          }
        : null;

    return {
      remiseAppliquee: remise,
      articles,
      impact: {
        valeurSiVenduPleinTarif,
        recetteEstimee,
        ecartVsPleinTarif: arrondi(valeurSiVenduPleinTarif - recetteEstimee),
      },
      panierSurprise,
    };
  },
});

const JOURS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

function facteurMeteo(meteo: Meteo | null): number {
  if (!meteo) return 1;
  let facteur = 1;
  if ((meteo.precipitationMm ?? 0) >= 5) facteur *= 0.85;
  else if ((meteo.precipitationMm ?? 0) >= 1) facteur *= 0.93;
  if ((meteo.temperatureMax ?? 0) >= 28) facteur *= 1.1;
  return Math.round(facteur * 100) / 100;
}

const prevoirProduction = tool({
  description:
    "Estime les quantités à préparer pour un jour donné en croisant l'historique " +
    "des ventes (par jour de semaine) et la météo prévue. Renvoie, par produit, " +
    "la moyenne historique de ce jour et une recommandation ajustée à la météo. " +
    "À utiliser pour 'combien je prépare demain ?'. Appuie-toi sur ces chiffres " +
    "pour donner un conseil clair et chiffré à Madeleine.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe("Jour à préparer au format AAAA-MM-JJ (défaut : demain)"),
    produits: z
      .array(z.string())
      .optional()
      .describe("Limiter la prévision à certains produits (optionnel)"),
  }),
  execute: async ({ date, produits }) => {
    const cible =
      date ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const [annee, mois, jourDuMois] = cible.split("-").map(Number);
    const jour = JOURS[new Date(annee, mois - 1, jourDuMois).getDay()];

    const ventes = await getVentes();
    const ventesDuJour = ventes.filter((vente) => vente.jour === jour);

    const cumulParProduit: Record<string, { total: number; jours: Set<string> }> =
      {};
    for (const vente of ventesDuJour) {
      const nom = vente.produit ?? "Inconnu";
      cumulParProduit[nom] ??= { total: 0, jours: new Set() };
      cumulParProduit[nom].total += vente.quantiteVendue ?? 0;
      if (vente.date) cumulParProduit[nom].jours.add(vente.date);
    }

    const meteo = await getMeteo(cible);
    const facteur = facteurMeteo(meteo);

    let lignes = Object.entries(cumulParProduit).map(([produit, cumul]) => {
      const nbJoursObserves = cumul.jours.size || 1;
      const moyenne = cumul.total / nbJoursObserves;
      return {
        produit,
        quantiteMoyenneCeJour: Math.round(moyenne),
        quantiteRecommandee: Math.round(moyenne * facteur),
        joursObserves: cumul.jours.size,
      };
    });

    if (produits?.length) {
      const aiguilles = produits.map((p) => p.toLowerCase());
      lignes = lignes.filter((ligne) =>
        aiguilles.some((aiguille) =>
          ligne.produit.toLowerCase().includes(aiguille),
        ),
      );
    }

    lignes.sort((a, b) => b.quantiteRecommandee - a.quantiteRecommandee);

    return {
      date: cible,
      jour,
      meteo: meteo
        ? {
            resume: meteo.resume,
            temperatureMax: meteo.temperatureMax,
            precipitationMm: meteo.precipitationMm,
          }
        : null,
      ajustementMeteoPct: Math.round((facteur - 1) * 100),
      produits: lignes,
    };
  },
});

export const theoTools = {
  consulterStock,
  consulterCatalogue,
  consulterVentes,
  envoyerCommandeFournisseur,
  planAntiGaspi,
  prevoirProduction,
};
