# 🥐 Théo — l'assistant boulangerie de Madeleine Croûton

Agent IA conversationnel qui aide **Madeleine Croûton**, boulangère-pâtissière à
Saint-Germain-des-Croissants, à piloter sa boulangerie : consulter ses stocks et
ses ventes, commander chez ses fournisseurs, et écouler ses invendus avant qu'ils
ne rassissent.

> Test technique AI Sisters — Ingénieur IA Senior.

## Pourquoi « Théo »

Théo est le prénom du petit-fils de Madeleine, celui qui lui a parlé d'IA.
L'agent reprend ce prénom pour la mettre en confiance : il tutoie Madeleine,
parle simplement, explique ce qu'il fait avant de le faire, et demande toujours
confirmation avant d'engager une dépense.

## Stack

| Brique | Choix | Pourquoi |
| --- | --- | --- |
| Langage | TypeScript | Stack maîtrisée, intégration directe front/back |
| Agent | Vercel AI SDK | Tool-calling natif, code lisible, prêt pour le web |
| LLM | Claude (Anthropic) | Excellent raisonnement et tool-calling |
| Données | Notion SDK | Base fournie par AI Sisters |
| Email | Nodemailer + Gmail SMTP | Envoi réel de commande fournisseur |
| Interface | Next.js (App Router) | UI chat légère, exécutable en local |

## Les 3 tools

1. **📚 Lecture Notion** — consulte stocks, ventes et catalogue produits.
2. **📧 Commande fournisseur** — génère un email, l'envoie en SMTP et trace la
   commande dans Notion (avec confirmation humaine).
3. **♻️ Anti-gaspillage génératif** — détecte les invendus à risque et génère un
   plan d'action commercial (panier anti-gaspi, promo, post réseaux sociaux) dans
   la voix de Madeleine.

## Installation

```bash
npm install
cp .env.example .env.local   # puis renseigne tes clés
npm run dev
```

Ouvre http://localhost:3100

## Variables d'environnement

Voir [.env.example](.env.example). Il faut une clé Anthropic, le token Notion +
les IDs des 4 bases, et des identifiants SMTP Gmail (mot de passe d'application).

## Tests

Tests unitaires avec **Vitest**, en style BDD (Given-When-Then, structure
Arrange-Act-Assert). Seules les frontières externes sont mockées (l'API Notion) :
la vraie logique métier (mapping des données, calcul des seuils, filtres,
agrégation des ventes) est testée sans I/O réelle.

```bash
pnpm test         # lance la suite une fois
pnpm test:watch   # mode watch
```

## Architecture

_À compléter au fil des étapes._

## Pistes d'amélioration

_À compléter._
