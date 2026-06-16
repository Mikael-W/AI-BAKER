import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DATABASES = {
  stock: process.env.NOTION_DB_STOCK ?? "",
  catalogue: process.env.NOTION_DB_CATALOGUE ?? "",
  ventes: process.env.NOTION_DB_VENTES ?? "",
  commandes: process.env.NOTION_DB_COMMANDES ?? "",
} as const;

const dataSourceCache = new Map<string, string>();

async function resolveDataSource(databaseId: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) return cached;

  const database = (await notion.databases.retrieve({
    database_id: databaseId,
  })) as { data_sources?: { id: string }[] };

  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) {
    throw new Error(`Aucun data source trouvé pour la base ${databaseId}`);
  }

  dataSourceCache.set(databaseId, dataSourceId);
  return dataSourceId;
}

type NotionFilter = Record<string, unknown>;
type NotionSort = Record<string, unknown>;
type NotionPage = { properties: Record<string, any> };

async function queryAll(
  databaseId: string,
  options: { filter?: NotionFilter; sorts?: NotionSort[] } = {},
): Promise<NotionPage[]> {
  const dataSourceId = await resolveDataSource(databaseId);
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      ...(options.filter ? { filter: options.filter as any } : {}),
      ...(options.sorts ? { sorts: options.sorts as any } : {}),
    });
    pages.push(...(response.results as NotionPage[]));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages;
}

const readText = (prop: any): string =>
  (prop?.title ?? prop?.rich_text ?? [])
    .map((fragment: any) => fragment.plain_text)
    .join("");

const readNumber = (prop: any): number | null =>
  prop?.type === "formula" ? prop.formula?.number ?? null : prop?.number ?? null;

const readSelect = (prop: any): string | null => prop?.select?.name ?? null;

const readEmail = (prop: any): string | null => prop?.email ?? null;

const readDate = (prop: any): string | null => prop?.date?.start ?? null;

const readCheckbox = (prop: any): boolean => prop?.checkbox ?? false;

export type Ingredient = {
  ingredient: string;
  quantiteEnStock: number | null;
  unite: string | null;
  seuilAlerte: number | null;
  sousSeuil: boolean;
  fournisseur: string | null;
  emailFournisseur: string | null;
  prixUnitaire: number | null;
  derniereLivraison: string | null;
};

export type Produit = {
  produit: string;
  categorie: string | null;
  prixVenteTTC: number | null;
  coutRevient: number | null;
  margePourcent: number | null;
  tempsPreparationMin: number | null;
  ingredientsPrincipaux: string;
  disponible: boolean;
};

export type Vente = {
  produit: string | null;
  date: string | null;
  jour: string | null;
  quantiteVendue: number | null;
  ca: number | null;
};

export async function getStock(): Promise<Ingredient[]> {
  const pages = await queryAll(DATABASES.stock);
  return pages.map((page) => {
    const p = page.properties;
    const quantite = readNumber(p["Quantité en stock"]);
    const seuil = readNumber(p["Seuil alerte"]);
    return {
      ingredient: readText(p["Ingrédient"]),
      quantiteEnStock: quantite,
      unite: readSelect(p["Unité"]),
      seuilAlerte: seuil,
      sousSeuil: quantite !== null && seuil !== null && quantite <= seuil,
      fournisseur: readSelect(p["Fournisseur"]),
      emailFournisseur: readEmail(p["Email fournisseur"]),
      prixUnitaire: readNumber(p["Prix unitaire (€)"]),
      derniereLivraison: readDate(p["Dernière livraison"]),
    };
  });
}

export async function getCatalogue(): Promise<Produit[]> {
  const pages = await queryAll(DATABASES.catalogue);
  return pages.map((page) => {
    const p = page.properties;
    return {
      produit: readText(p["Produit"]),
      categorie: readSelect(p["Catégorie"]),
      prixVenteTTC: readNumber(p["Prix de vente TTC (€)"]),
      coutRevient: readNumber(p["Coût de revient (€)"]),
      margePourcent: readNumber(p["Marge (%)"]),
      tempsPreparationMin: readNumber(p["Temps de préparation (min)"]),
      ingredientsPrincipaux: readText(p["Ingrédients principaux"]),
      disponible: readCheckbox(p["Disponible"]),
    };
  });
}

export async function getVentes(options: {
  produit?: string;
  depuis?: string;
  jusqua?: string;
} = {}): Promise<Vente[]> {
  const pages = await queryAll(DATABASES.ventes, {
    sorts: [{ property: "Date", direction: "ascending" }],
  });

  const ventes = pages.map((page) => {
    const p = page.properties;
    return {
      produit: readSelect(p["Produit"]),
      date: readDate(p["Date"]),
      jour: readSelect(p["Jour"]),
      quantiteVendue: readNumber(p["Quantité vendue"]),
      ca: readNumber(p["CA (€)"]),
    };
  });

  return ventes.filter((vente) => {
    if (options.produit && vente.produit !== options.produit) return false;
    if (options.depuis && (vente.date ?? "") < options.depuis) return false;
    if (options.jusqua && (vente.date ?? "") > options.jusqua) return false;
    return true;
  });
}

export type NouvelleCommande = {
  reference: string;
  fournisseur: string;
  date: string;
  produitsCommandes: string;
  montantEstime: number | null;
  emailDestinataire: string;
  statut: "Brouillon" | "Envoyée" | "Confirmée" | "Livrée";
  notes?: string;
};

export async function creerCommandeFournisseur(
  commande: NouvelleCommande,
): Promise<void> {
  const dataSourceId = await resolveDataSource(DATABASES.commandes);

  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      "Référence commande": {
        title: [{ text: { content: commande.reference } }],
      },
      Fournisseur: { select: { name: commande.fournisseur } },
      "Date commande": { date: { start: commande.date } },
      "Produits commandés": {
        rich_text: [{ text: { content: commande.produitsCommandes } }],
      },
      "Montant estimé (€)": { number: commande.montantEstime },
      "Email envoyé à": { email: commande.emailDestinataire },
      Statut: { select: { name: commande.statut } },
      Notes: {
        rich_text: commande.notes ? [{ text: { content: commande.notes } }] : [],
      },
    },
  } as Parameters<typeof notion.pages.create>[0]);
}
