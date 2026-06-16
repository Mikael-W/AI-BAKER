import { describe, test, expect, vi, beforeEach } from "vitest";

const { retrieveMock, queryMock } = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@notionhq/client", () => ({
  Client: class {
    databases = { retrieve: retrieveMock };
    dataSources = { query: queryMock };
  },
}));

import { getStock, getCatalogue, getVentes } from "./notion";

const page = (results: unknown[], cursor: string | null = null) => ({
  results,
  has_more: cursor !== null,
  next_cursor: cursor,
});

const stockPage = (over: {
  ingredient?: string;
  quantite?: number | null;
  seuil?: number | null;
}) => {
  const quantite = "quantite" in over ? over.quantite : 6;
  const seuil = "seuil" in over ? over.seuil : 10;
  return {
    properties: {
      Ingrédient: { type: "title", title: [{ plain_text: over.ingredient ?? "Beurre AOP" }] },
      "Quantité en stock": { type: "number", number: quantite },
      Unité: { type: "select", select: { name: "kg" } },
      "Seuil alerte": { type: "number", number: seuil },
      Fournisseur: { type: "select", select: { name: "Laiterie du Midi" } },
      "Email fournisseur": { type: "email", email: "commandes@laiterie.fr" },
      "Prix unitaire (€)": { type: "number", number: 7.5 },
      "Dernière livraison": { type: "date", date: { start: "2026-02-08" } },
    },
  };
};

const cataloguePage = () => ({
  properties: {
    Produit: { type: "title", title: [{ plain_text: "Éclair au chocolat" }] },
    Catégorie: { type: "select", select: { name: "Pâtisserie" } },
    "Prix de vente TTC (€)": { type: "number", number: 3.5 },
    "Coût de revient (€)": { type: "number", number: 1.1 },
    "Marge (%)": { type: "formula", formula: { type: "number", number: 69 } },
    "Temps de préparation (min)": { type: "number", number: 30 },
    "Ingrédients principaux": {
      type: "rich_text",
      rich_text: [{ plain_text: "Pâte à choux, chocolat" }],
    },
    Disponible: { type: "checkbox", checkbox: true },
  },
});

const ventePage = (produit: string, date: string, quantite: number, ca: number) => ({
  properties: {
    Produit: { type: "select", select: { name: produit } },
    Date: { type: "date", date: { start: date } },
    Jour: { type: "select", select: { name: "Lundi" } },
    "Quantité vendue": { type: "number", number: quantite },
    "CA (€)": { type: "number", number: ca },
  },
});

beforeEach(() => {
  retrieveMock.mockReset();
  queryMock.mockReset();
  retrieveMock.mockResolvedValue({ data_sources: [{ id: "ds_test" }] });
});

describe("Given an ingredient whose quantity is below its alert threshold", () => {
  describe("When the stock is queried", () => {
    test("Then the ingredient is flagged as below threshold", async () => {
      queryMock.mockResolvedValue(page([stockPage({ quantite: 6, seuil: 10 })]));

      const stock = await getStock();

      expect(stock[0].sousSeuil).toBe(true);
    });
  });
});

describe("Given an ingredient whose quantity equals its alert threshold", () => {
  describe("When the stock is queried", () => {
    test("Then the ingredient is considered below threshold", async () => {
      queryMock.mockResolvedValue(page([stockPage({ quantite: 10, seuil: 10 })]));

      const stock = await getStock();

      expect(stock[0].sousSeuil).toBe(true);
    });
  });
});

describe("Given an ingredient whose quantity is above its alert threshold", () => {
  describe("When the stock is queried", () => {
    test("Then the ingredient is not flagged as below threshold", async () => {
      queryMock.mockResolvedValue(page([stockPage({ quantite: 45, seuil: 20 })]));

      const stock = await getStock();

      expect(stock[0].sousSeuil).toBe(false);
    });
  });
});

describe("Given an ingredient with no quantity set", () => {
  describe("When the stock is queried", () => {
    test("Then the ingredient is not flagged as below threshold", async () => {
      queryMock.mockResolvedValue(page([stockPage({ quantite: null, seuil: 10 })]));

      const stock = await getStock();

      expect(stock[0].sousSeuil).toBe(false);
    });
  });
});

describe("Given a complete Notion stock page", () => {
  describe("When the stock is queried", () => {
    test("Then every Notion field is mapped onto the domain object", async () => {
      queryMock.mockResolvedValue(page([stockPage({ ingredient: "Farine T65" })]));

      const stock = await getStock();

      expect(stock[0]).toMatchObject({
        ingredient: "Farine T65",
        unite: "kg",
        fournisseur: "Laiterie du Midi",
        emailFournisseur: "commandes@laiterie.fr",
        prixUnitaire: 7.5,
        derniereLivraison: "2026-02-08",
      });
    });
  });
});

describe("Given a stock spread across several Notion pages", () => {
  describe("When the stock is queried", () => {
    test("Then ingredients from every page are returned", async () => {
      queryMock
        .mockResolvedValueOnce(page([stockPage({ ingredient: "Beurre AOP" })], "cursor"))
        .mockResolvedValueOnce(page([stockPage({ ingredient: "Farine T65" })]));

      const stock = await getStock();

      expect(stock.map((item) => item.ingredient)).toEqual(["Beurre AOP", "Farine T65"]);
    });
  });
});

describe("Given a product whose margin is a Notion formula", () => {
  describe("When the catalogue is queried", () => {
    test("Then the margin is read from the formula computed value", async () => {
      queryMock.mockResolvedValue(page([cataloguePage()]));

      const catalogue = await getCatalogue();

      expect(catalogue[0].margePourcent).toBe(69);
    });

    test("Then availability is read from the checkbox", async () => {
      queryMock.mockResolvedValue(page([cataloguePage()]));

      const catalogue = await getCatalogue();

      expect(catalogue[0].disponible).toBe(true);
    });
  });
});

describe("Given sales of several products over several days", () => {
  describe("When sales are queried without a filter", () => {
    test("Then every sales row is returned", async () => {
      queryMock.mockResolvedValue(
        page([
          ventePage("Croissant pur beurre", "2026-02-02", 30, 42),
          ventePage("Baguette tradition", "2026-02-03", 100, 130),
        ]),
      );

      const ventes = await getVentes();

      expect(ventes).toHaveLength(2);
    });
  });

  describe("When sales are filtered by product", () => {
    test("Then only that product's sales are returned", async () => {
      queryMock.mockResolvedValue(
        page([
          ventePage("Croissant pur beurre", "2026-02-02", 30, 42),
          ventePage("Baguette tradition", "2026-02-03", 100, 130),
        ]),
      );

      const ventes = await getVentes({ produit: "Baguette tradition" });

      expect(ventes).toEqual([
        expect.objectContaining({ produit: "Baguette tradition", quantiteVendue: 100 }),
      ]);
    });
  });

  describe("When sales are filtered by period", () => {
    test("Then only sales within the period are returned", async () => {
      queryMock.mockResolvedValue(
        page([
          ventePage("Croissant pur beurre", "2026-02-01", 10, 14),
          ventePage("Croissant pur beurre", "2026-02-05", 20, 28),
          ventePage("Croissant pur beurre", "2026-02-10", 30, 42),
        ]),
      );

      const ventes = await getVentes({ depuis: "2026-02-03", jusqua: "2026-02-07" });

      expect(ventes.map((vente) => vente.date)).toEqual(["2026-02-05"]);
    });
  });
});
