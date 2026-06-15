import type { Ingredient, Produit, Vente } from "@/lib/notion";

export const beurre: Ingredient = {
  ingredient: "Beurre AOP",
  quantiteEnStock: 6,
  unite: "kg",
  seuilAlerte: 10,
  sousSeuil: true,
  fournisseur: "Laiterie du Midi",
  emailFournisseur: "commandes@laiterie.fr",
  prixUnitaire: 7.5,
  derniereLivraison: "2026-02-08",
};

export const farine: Ingredient = {
  ingredient: "Farine T65",
  quantiteEnStock: 45,
  unite: "kg",
  seuilAlerte: 20,
  sousSeuil: false,
  fournisseur: "Minoterie Dupont",
  emailFournisseur: "commandes@minoterie-dupont.fr",
  prixUnitaire: 0.78,
  derniereLivraison: "2026-02-10",
};

export const eclair: Produit = {
  produit: "Éclair au chocolat",
  categorie: "Pâtisserie",
  prixVenteTTC: 3.5,
  coutRevient: 1.1,
  margePourcent: 69,
  tempsPreparationMin: 30,
  ingredientsPrincipaux: "Pâte à choux, chocolat",
  disponible: true,
};

export const baguette: Produit = {
  produit: "Baguette tradition",
  categorie: "Pain",
  prixVenteTTC: 1.3,
  coutRevient: 0.35,
  margePourcent: 73,
  tempsPreparationMin: 180,
  ingredientsPrincipaux: "Farine, eau, levure, sel",
  disponible: true,
};

export const ventes: Vente[] = [
  { produit: "Croissant pur beurre", date: "2026-02-02", jour: "Lundi", quantiteVendue: 30, ca: 42 },
  { produit: "Croissant pur beurre", date: "2026-02-03", jour: "Mardi", quantiteVendue: 20, ca: 28 },
  { produit: "Baguette tradition", date: "2026-02-02", jour: "Lundi", quantiteVendue: 100, ca: 130 },
];
