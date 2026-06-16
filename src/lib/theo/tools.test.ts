import { describe, test, expect, vi, beforeEach } from "vitest";

const {
  getStockMock,
  getCatalogueMock,
  getVentesMock,
  creerCommandeMock,
  envoyerEmailMock,
  getMeteoMock,
} = vi.hoisted(() => ({
  getStockMock: vi.fn(),
  getCatalogueMock: vi.fn(),
  getVentesMock: vi.fn(),
  creerCommandeMock: vi.fn(),
  envoyerEmailMock: vi.fn(),
  getMeteoMock: vi.fn(),
}));

vi.mock("@/lib/notion/notion", () => ({
  getStock: getStockMock,
  getCatalogue: getCatalogueMock,
  getVentes: getVentesMock,
  creerCommandeFournisseur: creerCommandeMock,
}));

vi.mock("@/lib/email/email", () => ({
  envoyerEmail: envoyerEmailMock,
}));

vi.mock("@/lib/weather/weather", () => ({
  getMeteo: getMeteoMock,
}));

import { theoTools } from "@/lib/theo/tools";
import { beurre, farine, eclair, baguette, ventes } from "@/test/fixtures";

type Tool = (typeof theoTools)[keyof typeof theoTools];

const run = (tool: Tool, input: unknown) =>
  (tool.execute as (i: unknown, o: unknown) => Promise<unknown>)(input, {
    toolCallId: "test",
    messages: [],
  });

beforeEach(() => {
  getStockMock.mockReset();
  getCatalogueMock.mockReset();
  getVentesMock.mockReset();
  creerCommandeMock.mockReset();
  envoyerEmailMock.mockReset();
  getMeteoMock.mockReset();
});

describe("Given a stock with one ingredient below threshold and one above", () => {
  describe("When the consulterStock tool filters by ingredient name", () => {
    test("Then only ingredients whose name matches are returned", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);

      const result = (await run(theoTools.consulterStock, { ingredient: "beurre" })) as typeof beurre[];

      expect(result).toEqual([beurre]);
    });
  });

  describe("When the consulterStock tool keeps only below-threshold ingredients", () => {
    test("Then only below-threshold ingredients are returned", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);

      const result = (await run(theoTools.consulterStock, {
        seulementSousSeuil: true,
      })) as typeof beurre[];

      expect(result).toEqual([beurre]);
    });
  });

  describe("When the consulterStock tool is called without a filter", () => {
    test("Then every ingredient is returned", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);

      const result = (await run(theoTools.consulterStock, {})) as typeof beurre[];

      expect(result).toHaveLength(2);
    });
  });
});

describe("Given a catalogue of several products", () => {
  describe("When the consulterCatalogue tool filters by product name", () => {
    test("Then only products whose name matches are returned", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.consulterCatalogue, {
        produit: "éclair",
      })) as typeof eclair[];

      expect(result).toEqual([eclair]);
    });
  });

  describe("When the consulterCatalogue tool filters by category", () => {
    test("Then only products in that category are returned", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.consulterCatalogue, {
        categorie: "Pain",
      })) as typeof eclair[];

      expect(result).toEqual([baguette]);
    });

    test("Then the category match ignores case and accents", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.consulterCatalogue, {
        categorie: "patisserie",
      })) as typeof eclair[];

      expect(result).toEqual([eclair]);
    });
  });
});

describe("Given sales of several products", () => {
  describe("When the consulterVentes tool aggregates the period", () => {
    test("Then the total quantity sold is the sum of all sales", async () => {
      getVentesMock.mockResolvedValue(ventes);

      const result = (await run(theoTools.consulterVentes, {})) as {
        totalQuantiteVendue: number;
      };

      expect(result.totalQuantiteVendue).toBe(150);
    });

    test("Then the total revenue is the sum of all revenues", async () => {
      getVentesMock.mockResolvedValue(ventes);

      const result = (await run(theoTools.consulterVentes, {})) as {
        chiffreAffaires: number;
      };

      expect(result.chiffreAffaires).toBe(200);
    });

    test("Then sales are grouped by product", async () => {
      getVentesMock.mockResolvedValue(ventes);

      const result = (await run(theoTools.consulterVentes, {})) as {
        parProduit: Record<string, { quantite: number; ca: number }>;
      };

      expect(result.parProduit["Croissant pur beurre"]).toEqual({ quantite: 50, ca: 70 });
    });
  });
});

describe("Given no sales over the requested period", () => {
  describe("When the consulterVentes tool is called", () => {
    test("Then it returns a line count of zero", async () => {
      getVentesMock.mockResolvedValue([]);

      const result = (await run(theoTools.consulterVentes, {})) as { lignes: number };

      expect(result.lignes).toBe(0);
    });
  });
});

describe("Given an ingredient in stock with a known supplier", () => {
  describe("When the supplier order tool is run", () => {
    test("Then the email is sent to the supplier address from the stock", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);
      envoyerEmailMock.mockResolvedValue({ messageId: "abc" });
      creerCommandeMock.mockResolvedValue(undefined);

      await run(theoTools.envoyerCommandeFournisseur, {
        ingredient: "Beurre AOP",
        quantite: 4,
        objet: "Commande beurre",
        corps: "Bonjour, je commande 4 kg de beurre.",
      });

      expect(envoyerEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({ destinataire: "commandes@laiterie.fr" }),
      );
    });

    test("Then the order is recorded in the supplier order register", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);
      envoyerEmailMock.mockResolvedValue({ messageId: "abc" });
      creerCommandeMock.mockResolvedValue(undefined);

      await run(theoTools.envoyerCommandeFournisseur, {
        ingredient: "Beurre AOP",
        quantite: 4,
        objet: "Commande beurre",
        corps: "Bonjour, je commande 4 kg de beurre.",
      });

      expect(creerCommandeMock).toHaveBeenCalledWith(
        expect.objectContaining({ fournisseur: "Laiterie du Midi", statut: "Envoyée" }),
      );
    });

    test("Then the estimated amount is the quantity times the unit price", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);
      envoyerEmailMock.mockResolvedValue({ messageId: "abc" });
      creerCommandeMock.mockResolvedValue(undefined);

      const result = (await run(theoTools.envoyerCommandeFournisseur, {
        ingredient: "Beurre AOP",
        quantite: 4,
        objet: "Commande beurre",
        corps: "Bonjour, je commande 4 kg de beurre.",
      })) as { montantEstime: number };

      expect(result.montantEstime).toBe(30);
    });
  });
});

describe("Given an ingredient that is not in the stock", () => {
  describe("When the supplier order tool is run", () => {
    test("Then it reports a failure", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);

      const result = (await run(theoTools.envoyerCommandeFournisseur, {
        ingredient: "Caviar",
        quantite: 1,
        objet: "Commande",
        corps: "Bonjour",
      })) as { succes: boolean };

      expect(result.succes).toBe(false);
    });

    test("Then no email is sent", async () => {
      getStockMock.mockResolvedValue([beurre, farine]);

      await run(theoTools.envoyerCommandeFournisseur, {
        ingredient: "Caviar",
        quantite: 1,
        objet: "Commande",
        corps: "Bonjour",
      });

      expect(envoyerEmailMock).not.toHaveBeenCalled();
    });
  });
});

describe("Given unsold products that exist in the catalogue", () => {
  describe("When the anti-waste tool applies the default discount", () => {
    test("Then the discounted price is the normal price minus the discount", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.planAntiGaspi, {
        invendus: [{ produit: "Éclair au chocolat", quantite: 4 }],
      })) as { articles: { prixRemise: number }[] };

      expect(result.articles[0].prixRemise).toBe(2.45);
    });

    test("Then the estimated revenue sums the discounted lines", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.planAntiGaspi, {
        invendus: [{ produit: "Éclair au chocolat", quantite: 4 }],
      })) as { impact: { recetteEstimee: number } };

      expect(result.impact.recetteEstimee).toBe(9.8);
    });
  });
});

describe("Given a discount that would drop below the cost price", () => {
  describe("When the anti-waste tool computes the plan", () => {
    test("Then the discounted price is floored at the cost price", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.planAntiGaspi, {
        invendus: [{ produit: "Éclair au chocolat", quantite: 1 }],
        remisePct: 80,
      })) as { articles: { prixRemise: number; remiseLimiteeParCout: boolean }[] };

      expect(result.articles[0]).toMatchObject({
        prixRemise: 1.1,
        remiseLimiteeParCout: true,
      });
    });
  });
});

describe("Given several different unsold products", () => {
  describe("When the anti-waste tool computes the plan", () => {
    test("Then it suggests a surprise basket bundling them", async () => {
      getCatalogueMock.mockResolvedValue([eclair, baguette]);

      const result = (await run(theoTools.planAntiGaspi, {
        invendus: [
          { produit: "Éclair au chocolat", quantite: 2 },
          { produit: "Baguette tradition", quantite: 3 },
        ],
      })) as { panierSurprise: { contenu: string } | null };

      expect(result.panierSurprise?.contenu).toContain("Éclair au chocolat");
    });
  });
});

type Prevision = {
  jour: string;
  produits: { produit: string; quantiteRecommandee: number }[];
};

const recommande = (prevision: Prevision, produit: string) =>
  prevision.produits.find((ligne) => ligne.produit.includes(produit))
    ?.quantiteRecommandee;

describe("Given sales history for a given weekday and dry weather", () => {
  describe("When forecasting production for that weekday", () => {
    test("Then the recommendation equals the weekday average", async () => {
      getVentesMock.mockResolvedValue(ventes);
      getMeteoMock.mockResolvedValue(null);

      const result = (await run(theoTools.prevoirProduction, {
        date: "2026-01-05",
      })) as Prevision;

      expect(recommande(result, "Baguette")).toBe(100);
    });

    test("Then the resolved weekday is reported", async () => {
      getVentesMock.mockResolvedValue(ventes);
      getMeteoMock.mockResolvedValue(null);

      const result = (await run(theoTools.prevoirProduction, {
        date: "2026-01-05",
      })) as Prevision;

      expect(result.jour).toBe("Lundi");
    });
  });
});

describe("Given a rainy weather forecast", () => {
  describe("When forecasting production for that weekday", () => {
    test("Then the recommendation is reduced by the rain factor", async () => {
      getVentesMock.mockResolvedValue(ventes);
      getMeteoMock.mockResolvedValue({
        date: "2026-01-05",
        temperatureMax: 12,
        precipitationMm: 6,
        resume: "pluvieux",
      });

      const result = (await run(theoTools.prevoirProduction, {
        date: "2026-01-05",
      })) as Prevision;

      expect(recommande(result, "Baguette")).toBe(85);
    });
  });
});
