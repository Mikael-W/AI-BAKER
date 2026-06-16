# 🥐 Théo — l'assistant boulangerie de Madeleine Croûton

Agent IA conversationnel qui aide **Madeleine Croûton**, boulangère-pâtissière à
Saint-Germain-des-Croissants, à piloter sa boulangerie : consulter ses stocks et
ses ventes, commander chez ses fournisseurs, et écouler ses invendus avant qu'ils
ne rassissent.

> Test technique AI Sisters — Ingénieur IA Senior.

## Pourquoi « Théo »

Théo est le prénom du petit-fils de Madeleine, celui qui lui a parlé d'IA.
L'agent reprend ce prénom pour la mettre en confiance : il tutoie Madeleine,
parle simplement (zéro jargon), explique ce qu'il fait avant de le faire, et
demande toujours confirmation avant d'engager une dépense. C'est un **copilote**,
pas un pilote automatique.

## Stack

| Brique | Choix | Pourquoi |
| --- | --- | --- |
| Langage | TypeScript | Stack maîtrisée, un seul langage front + back |
| Agent | Vercel AI SDK | Tool-calling natif, streaming, code lisible, prêt pour le web |
| LLM | Claude (Anthropic) | Excellent raisonnement et tool-calling |
| Données | Notion SDK (`@notionhq/client`) | Base fournie par AI Sisters |
| Email | Nodemailer + Gmail SMTP | Envoi réel de commande fournisseur |
| Interface | Next.js (App Router) | UI chat légère, exécutable en local |
| Tests | Vitest | Tests unitaires BDD, mocks des frontières externes |

## Les outils de Théo

L'agent dispose de 6 outils qu'il appelle de façon autonome. Le 3e tool (au
choix) est décliné en deux capacités complémentaires — orchestration et
génération — pour couvrir les trois registres d'un agent : lire, agir, créer.

1. **📚 Lecture Notion** — `consulterStock`, `consulterCatalogue`,
   `consulterVentes`. Granularité fine pour un meilleur choix d'outil par le LLM.
   Les chiffres sont agrégés côté code (pas par le LLM).
2. **📧 Commande fournisseur** — `envoyerCommandeFournisseur` : récupère le
   contact et le prix du fournisseur depuis le stock, envoie un **vrai email**
   (SMTP) et **trace la commande dans Notion**, après confirmation de Madeleine.
3. **🥖 Prévision de production** — `prevoirProduction` : **orchestre** plusieurs
   sources (historique des ventes par jour de semaine + **météo réelle**
   Open-Meteo) pour recommander les quantités à préparer, ajustées au temps prévu.
4. **♻️ Anti-gaspillage génératif** — `planAntiGaspi` : calcule une remise qui
   reste **rentable** (jamais sous le coût de revient), chiffre la recette
   récupérée et propose un panier surprise ; Théo s'en sert pour rédiger une
   promo / un post réseaux sociaux dans la voix de Madeleine.

## Architecture

Chaque module vit dans son dossier, à côté de son test :

```
src/
├── app/
│   ├── page.tsx              UI chat (affiche les appels d'outils)
│   ├── globals.css
│   └── api/chat/route.ts     route de streaming (Claude + tools + multi-step)
├── lib/
│   ├── notion/
│   │   ├── notion.ts         accès Notion : lecture (stock/catalogue/ventes) + écriture (commandes)
│   │   └── notion.test.ts
│   ├── email/
│   │   └── email.ts          envoi SMTP (Nodemailer/Gmail)
│   ├── weather/
│   │   └── weather.ts        météo (Open-Meteo, sans clé)
│   └── theo/
│       ├── prompt.ts         personnalité + garde-fous de Théo (system prompt)
│       ├── tools.ts          définition des 5 outils (Zod) consommés par l'agent
│       └── tools.test.ts
└── test/
    └── fixtures.ts           jeux de données typés partagés par les tests
```

Flux d'une requête :

```
Madeleine ─▶ UI chat ─▶ /api/chat ─▶ Claude ──(choisit un outil)──▶ tools.ts
                                       ▲                                │
                                       │                                ├─▶ lib/notion.ts ─▶ Notion API
                                       └────────(résultat de l'outil)───┤
                                                                        └─▶ lib/email.ts ─▶ Gmail SMTP
```

Principes de conception :

- **Séparation des responsabilités** : la logique Notion/SMTP vit dans `lib/`,
  indépendante de l'agent → testable seule.
- **Données épurées pour le LLM** : on ne lui passe pas le JSON brut de Notion,
  mais des objets typés et lisibles → moins de tokens, moins d'hallucination.
- **Le code calcule, le LLM rédige** : seuils, marges, agrégations et remises
  rentables sont calculés en TypeScript ; le LLM se concentre sur le langage.
- **Human-in-the-loop garanti** : l'envoi d'une commande passe par l'approbation
  native du SDK (`needsApproval`). Le modèle *propose* l'email, mais le code
  d'envoi ne s'exécute qu'après un clic « Confirmer » de Madeleine — ce n'est pas
  une promesse du prompt, c'est techniquement bloqué côté serveur sans validation.
- **Agent cadré** : le system prompt limite Théo au domaine boulangerie et
  résiste aux détournements (prompt injection), tout en autorisant les tâches
  créatives *pour la boutique*.

## Installation

```bash
pnpm install
cp .env.example .env.local   # puis renseigne tes clés
pnpm dev
```

Ouvre http://localhost:3100

## Variables d'environnement

Voir [.env.example](.env.example) :

- `ANTHROPIC_API_KEY` — clé Claude (modèle par défaut `claude-opus-4-8`,
  surchargeable via `ANTHROPIC_MODEL`)
- `NOTION_TOKEN` + `NOTION_DB_*` — token d'intégration et IDs des 4 bases
- `SMTP_*` — identifiants Gmail (mot de passe d'application) pour l'envoi réel
- `OPENMETEO_API_URL` — endpoint météo Open-Meteo (sans clé) pour la prévision ;
  si absent, la prévision fonctionne sans ajustement météo

## Tests

Tests unitaires avec **Vitest**, en style BDD (Given-When-Then, structure
Arrange-Act-Assert). Seules les frontières externes sont mockées (API Notion,
SMTP) : la vraie logique métier (mapping, seuils, filtres, agrégation des ventes,
remise rentable, résolution du fournisseur) est testée sans I/O réelle.

```bash
pnpm test         # lance la suite une fois
pnpm test:watch   # mode watch
```

## Pistes d'amélioration

**Produit / business**
- **Prévision plus fine** : la prévision actuelle se base sur ~2 semaines
  d'historique (peu d'échantillons par jour) et un ajustement météo heuristique ;
  avec plus de données, passer à un vrai modèle saisonnier (fêtes, vacances).
- **Invendus en temps réel** : brancher la caisse/POS au lieu d'une saisie
  manuelle des invendus.
- **Planning de cuisson** : prolonger la prévision en planning du fournil
  (ordre et heures d'enfournement) en croisant temps de préparation et stocks.
- **Canal réel** : WhatsApp Business plutôt qu'un navigateur — Madeleine a son
  téléphone dans la poche du tablier, pas un terminal.

**Technique / passage en production**
- Commande **multi-lignes / multi-fournisseurs** en un seul email.
- **Persistance** des conversations, authentification, multi-utilisateur.
- **Observabilité** : logs, traçabilité des appels d'outils, suivi des coûts
  tokens, rate limiting.
- **Évaluations (evals)** automatisées des réponses de l'agent (qualité,
  non-régression du comportement et des garde-fous).
- **Cache** des lectures Notion (TTL court) pour réduire latence et appels.
