import { describe, test, expect, vi, beforeEach } from "vitest";

const { getStockMock, getCatalogueMock, getVentesMock } = vi.hoisted(() => ({
  getStockMock: vi.fn(),
  getCatalogueMock: vi.fn(),
  getVentesMock: vi.fn(),
}));

vi.mock("@/lib/notion", () => ({
  getStock: getStockMock,
  getCatalogue: getCatalogueMock,
  getVentes: getVentesMock,
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
