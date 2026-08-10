# NEWDESIGN v2.0.0 — plan de refonte

> **Statut : proposition, en attente de validation.** Rien n'est implémenté.
> Base actuelle : `v1.18.0`, commit `fbd72f6`, 18 portes, 90 scénarios.

---

## 1. Pourquoi une v2

Un audit externe a formulé une charge centrale : *le dépôt a optimisé ce qui est facile à tester plutôt que ce qui prend la décision*.

En reproduisant ses contre-exemples, presque tous se sont confirmés. Les vagues 0 à 2 (livrées en v1.18.0) ont traité l'urgence : une erreur factuelle que le dépôt protégeait avec sa propre porte, un contrat d'entrée où les libellés affichés n'atteignaient aucune règle, des portes qui acceptaient l'invérifié, et un statut `validated` fondé sur quatre booléens auto-déclarés.

Il reste le défaut structurel, celui que ces correctifs n'adressent pas :

> **Les tests exercent un miroir des règles. Ils n'exercent jamais l'agent qui les lit en session.**

La v2 s'attaque à ce point. Elle ne rend pas la skill déterministe — c'est l'option A, écartée. Elle réduit ce que le modèle doit interpréter, lui fait vérifier sa propre sortie, et **mesure** ce qu'il fait réellement.

### Ce qui ne change pas

| Élément | Décision |
|---|---|
| **La base de connaissances** | 🔒 **Intouchée.** Aucun fait, règle, plancher, source ou date. Les sections partenaires restent. Seuls le tampon de version et une éventuelle référence de chemin bougent |
| **Le weekly check** | 🔒 **Conservé**, y compris ses 4 jobs. Voir §6, il demande du travail pour survivre |
| **Les 19 questions** | Aucune supprimée. Deux enrichies, le catalogue déménage |
| **La carte de sortie** | Même structure, mêmes emoji. Deux ajouts discrets |
| **L'option A** | Écartée : pas de moteur exécuté en production |

---

## 2. Les questions de l'interview

**Aucune suppression.** Deux enrichissements, pour des raisons précises :

| Question | Changement | Pourquoi |
|---|---|---|
| **Q8** taille | ➕ option `> 128 TB` | Impossible aujourd'hui d'exprimer un dépassement du plafond Hyperscale, donc la règle correspondante ne peut jamais se déclencher |
| **Q10** réseau | ➕ option `ports confirmés ouverts dans les deux sens` | On peut déclarer « bloqué » mais pas « confirmé ouvert ». MI Link ne peut donc jamais être *confirmé*, seulement non-infirmé |
| Les 19 | Le catalogue d'options **déménage** vers `reference/input-contract.md` | `SKILL.md` orchestre, il ne stocke plus le vocabulaire |
| ➕ nouveau | **Mode profil compact** avant l'interview | L'audit relève 20-26 tours. Coller un profil et ne poser que les manques |

---

## 3. La sortie

La structure de la carte ne change pas. Deux ajouts :

```
Éligibilité Phase A
• SQL MI — eligible_with_remediation : SQL Server 2016 compatible LRS…    ← existe déjà
                                                           [MI-LINK-HOST] ← ajouté
• SQL DB — unknown_requires_assessment : dépendances inconnues             ← existe déjà

🔁 Porte de méthode — LRS : passée (source 2016 dans 2008-2022, fenêtre ≤30 j)  ← ajouté
```

**L'auto-vérification est invisible quand elle passe.** C'est un contrôle effectué avant l'affichage : cible primaire éligible, méthode passant sa porte, inconnues de hard gate remontées, cible `unsupported` jamais primaire. Elle ne devient visible que si un invariant casse, et là elle expose l'incohérence au lieu de la réparer en silence.

La trace détaillée reste **sur demande**. Le défaut reste la carte lisible.

---

## 4. Les six lots

### Lot A — Auto-vérification et trace 🔴 *le seul qui agit en session*

| # | Tâche | Fichiers | Difficulté |
|---|---|---|---|
| A1 | Écrire les invariants de cohérence de sortie | `decision-rules.md` | 🟠 |
| A2 | Rendre l'auto-vérification obligatoire avant affichage | `SKILL.md` §Operations | 🟠 |
| A3 | Trace visible : tableau Phase A, ID de règle, résultat de porte | `SKILL.md` §Output | 🟠 |
| A4 | Porte : chaque scénario produit une trace cohérente | `run-tests.mjs` | 🟠 |
| A5 | Exemple mis à jour | `examples/` | 🟢 |

### Lot B — Contrats

| # | Tâche | Fichiers | Difficulté |
|---|---|---|---|
| B1 | `reference/input-contract.md` : 30 IDs, ~35 champs, types, consommateurs, comportement inconnu | nouveau | 🔴 |
| B2 | `reference/output-contract.md` | nouveau | 🟠 |
| B3 | Alléger `SKILL.md` : le catalogue part, les liens restent | `SKILL.md` | 🟠 |
| B4 | Q8, Q10 enrichies, mode profil compact | `SKILL.md` | 🟢 |
| B5 | Porte : tout champ a une question, un type, un consommateur, un scénario | `run-tests.mjs` | 🔴 |

### Lot C — Règles atomiques

| # | Tâche | Fichiers | Difficulté |
|---|---|---|---|
| C1 | Hard gates au format atomique : ID, champs consommés, comportement inconnu, preuve, source | `decision-rules.md` | 🔴 |
| C2 | Ranking ordonné en 10 étapes, à la place de « compare cost, compatibility, resilience » | `decision-rules.md` | 🟠 |
| C3 | Porte : chaque règle déclare ses champs, chaque champ existe au contrat | `run-tests.mjs` | 🟠 |
| C4 | 🔴 **Adapter le weekly check au nouveau format** | `check-consistency.mjs` | 🔴 |

### Lot D — Renommage et déplacement

| # | Tâche | Portée | Difficulté |
|---|---|---|---|
| D1 | `git mv SKILL.md skills/get-migration-assessment/SKILL.md` | historique préservé | 🟢 |
| D2 | `name: get-migration-assessment` | frontmatter | 🟢 |
| D3 | Références **de chemin** | ~8 fichiers sur 20 | 🟠 |
| D4 | 🔴 **`check-consistency.mjs` lit `SKILL.md` à la racine** | weekly check | 🟠 |
| D5 | Réinstaller, supprimer l'ancien dossier | `~/.copilot/skills/` | 🟢 |
| D6 | Message Teams à Travis et Jyotika | — | 🟢 |

### Lot E — Documentation, alignement v2.0.0

| # | Fichier | Volume | Difficulté |
|---|---|---|---|
| E1 | 🔴 **`README.md` — revue complète** | 289 l | 🔴 |
| E2 | `howto/how-the-skill-works.md` | 377 l | 🟠 |
| E3 | `blume/docs/index.mdx` | 221 l | 🟠 |
| E4 | `docs/…developer-pitch.md` | 789 l | 🔴 |
| E5 | `CONTRIBUTING.md`, `tests/README.md` | 69 + 40 l | 🟢 |
| E6 | Diagrammes `runtime-loop`, `skill-architecture`, `quality-gate` | 3 × 4 fichiers | 🟠 |

#### E1 — ce que la revue du README doit couvrir

| Section | État en v1.18 | Cible v2.0.0 |
|---|---|---|
| Badges | KB v1.18 | v2.0.0, 18 → N portes, 90 → N scénarios |
| Pitch d'ouverture | « regression-tested » | Positionner v2 : politique lisible, auto-vérifiée, mesurée |
| Pourquoi c'est fiable | 5 puces | Ajouter auto-vérification, trace, mesure runtime |
| Réponse à l'audit | 5 lignes, audit de 2025 | ➕ le nouvel audit et ce qu'il a produit |
| Ce qu'il y a dedans | table des fichiers | ➕ `input-contract`, `output-contract`, `evals/`, nouveau chemin de skill |
| Installation | `~/.copilot/skills/assessment-advisor` | ⚠️ nouveau nom **et** dépôt complet requis, pas seulement `SKILL.md` |
| Comment ça marche | 3 étapes | ➕ phase d'auto-vérification |
| Encart confiance | 3 niveaux | ⚠️ `high` n'existe plus, à réécrire |
| Encart couverture | 92,02 % de branches | ➕ distinguer couverture du miroir et mesure runtime |
| Poster / PDF | v1.18 | régénérés par le CI |
| Changelog | v1.18 en tête | ➕ ligne v2.0.0 |

**Point de vigilance :** l'installation change de nature. Aujourd'hui on clone le dépôt dans `~/.copilot/skills/assessment-advisor`. Avec la nouvelle arborescence, la skill référence `../../reference/…` : installer `SKILL.md` seul ne fonctionnera plus. Le README doit le dire explicitement.

### Lot F — B2, l'éval runtime

| # | Tâche | Difficulté |
|---|---|---|
| F1 | 8-12 fiches client, avec des « je ne sais pas » | 🟠 |
| F2 | Boucle conseiller ⟷ client simulé, 15-25 tours | 🔴 |
| F3 | Comparateur : conformité politique, stabilité inter-modèles, auto-cohérence | 🔴 |
| F4 | Invariants métamorphiques : label = ID, FR = EN, monotonie | 🟠 |
| F5 | Première mesure publiée, **sans seuil** | 🟢 |

---

## 5. Séquence et parallélisation

```
D  déplacement pur              ← commit mécanique isolé, diff lisible
        ↓
B + A  un seul passage          ← les deux éditent SKILL.md
        ↓
C  règles atomiques  ──────┐
        ↓                   │
E1 E2 E3 E4 E5 E6           │    ← ✅ vraiment parallèles, fichiers disjoints
        ↓                   │
      portes ←──────────────┘    ← C4 et D4 doivent passer ici
        ↓
   release v2.0.0
        ↓
        F                        ← mesure, valide l'ensemble
```

**Parallélisable :** le lot E uniquement. Six fichiers disjoints, sous-agents simultanés, gain estimé 40 % sur ce lot.

**Non parallélisable, et je préfère le dire :** A et B éditent tous deux `SKILL.md`, les paralléliser produirait des conflits, d'où la fusion en un passage. C dépend de B par construction. Les portes se lancent en séquence.

| Étape | Contenu | Commit |
|---|---|---|
| 1 | D — déplacement, renommage, zéro changement de contenu | 1 |
| 2 | B + A — contrats et auto-vérification | 1 |
| 3 | C — règles atomiques **et adaptation du weekly check** | 1 |
| 4 | E — documentation, 6 sous-agents | 1 |
| 5 | Portes, artefacts, Blume, **release v2.0.0** | PR artefacts |
| 6 | F — B2, première mesure | 1 |

---

## 6. 🔴 Impact sur le weekly check

**Tu veux le garder. Il est menacé par le lot C, et il faut le traiter dans le même lot.**

### Ce que le weekly check lit

| Script | Lit | Impact v2 |
|---|---|---|
| `check-consistency.mjs` | KB, `decision-rules.md`, **`SKILL.md`**, README | 🔴 **casse deux fois** |
| `decide.mjs` | KB, `decision-rules.md` | 🟡 diff substantiel, à revérifier |
| `apply-update.mjs` | KB, `decision-rules.md`, README | 🟡 tampon de version |
| `verify-claims.mjs` | `claims-registry.json` | 🟢 aucun |
| `classify-links.mjs`, `gather-news.mjs`, `ai-review.mjs`, `build-prompt.mjs` | — | 🟢 aucun |

### Rupture 1 — le déplacement de `SKILL.md`

`check-consistency.mjs` ouvre `SKILL.md` à la racine. Après `git mv`, le fichier n'y est plus : le script lève une erreur et le **job 1 échoue**, ce qui bloque les 3 suivants.

**Correctif :** une ligne, le nouveau chemin. Doit partir **dans le même commit que D**, sinon le weekly check est cassé entre deux commits.

### Rupture 2 — les règles atomiques, plus sérieuse

`extractGate` fonctionne ainsi :

```js
const candidates = text.split(/\r?\n/)
  .filter(line => terms.every(term => line.toLowerCase().includes(term)));
```

**Il cherche une ligne unique contenant tous les termes.** C'est ce parseur qui s'est cassé ce matin quand j'ai réordonné les sections de `SKILL.md` : il lisait le plancher Arc MI Link sur la première ligne contenant à la fois « arc » et « mi link », et le réordonnancement lui a fait lire 2017 au lieu de 2016.

Aujourd'hui une règle tient sur une ligne de tableau :

```
| Near-zero / online | **MI Link** | SQL Server 2016+, Enterprise…, Windows Server 2012 or later… |
```

Au format atomique, elle s'étale :

```
### MI-LINK-HOST — Host OS and edition
**Consumes:** source.os, source.osVersion, source.edition
**Unsupported when**
- Windows Server below 2012
```

**Les termes ne sont plus sur la même ligne. `extractGate` ne trouve plus rien.** Il retombe sur `extractWithPatterns(text)`, qui balaie le document entier et peut ramener la mauvaise valeur, ou rien.

Conséquence : `compareAcrossDocs` émet *« could not find gate in KB, decision-rules, or SKILL »*, et le weekly check crie au faux positif toutes les semaines jusqu'à ce qu'on cesse de le lire. **Un contrôle qu'on ignore est pire qu'un contrôle absent.**

### Correctif proposé — C4

Deux options :

| Option | Principe | Coût | Robustesse |
|---|---|---|---|
| **C4-a** | Parsing par **bloc de règle** : découper sur `### RULE-ID`, chercher les termes dans le bloc | 🟠 moyen | 🟢 bonne, le bloc est une unité sémantique |
| C4-b | Lire les valeurs depuis `decision-rules.data.json` au lieu du markdown | 🟢 faible | 🔴 supprime le contrôle : c'est justement l'écart data/prose qu'on veut détecter |

**Je recommande C4-a.** C4-b transformerait le contrôle en tautologie.

**Bénéfice indirect :** le format atomique rend le parsing *plus* fiable qu'aujourd'hui. Un bloc `### RULE-ID` est une frontière explicite, là où le parsing par proximité de ligne est un accident qui a déjà produit un bug ce matin.

### Vérification exigée avant release

- [ ] `check-consistency.mjs` lit le nouveau chemin de `SKILL.md`
- [ ] Les 4 portes Arc, les ports MI Link, la capacité MI Link et la limite de lot Arc sont toujours extraites
- [ ] **Test de sabotage** : introduire une divergence volontaire, vérifier que le weekly check la voit
- [ ] Déclenchement manuel : les 4 jobs verts
- [ ] `decide.mjs` détecte toujours un diff substantiel
- [ ] `apply-update.mjs` pose toujours le tampon de version

---

## 7. Hors périmètre

| Sujet | Pourquoi c'est exclu |
|---|---|
| **Restructuration de la KB** (WP4 de l'audit) | 531 lignes, 83 URLs, 187 constantes, 4 portes en dépendent. Mélangée au reste, la revue devient impossible et le risque de casser un fait sourcé est réel. À faire seule, avec sa propre revue |
| **Option A**, moteur exécuté | Écartée. Dépend d'une contrainte non maîtrisée : le dépôt cible doit accepter une skill qui exécute du code |
| **Seuil de divergence** | On mesure d'abord sur 2-3 releases, on fixe une valeur informée ensuite plutôt qu'arbitraire |

---

## 8. Ce que la v2 ne résoudra pas

Par honnêteté, et parce que la v1 s'est trompée en promettant trop :

- **B2 mesure l'accord, pas la justesse.** Si la politique est fausse, 100 % de concordance signifie que tout le monde est d'accord sur une erreur. Le plancher Windows Server 2012 aurait été « conforme à 100 % » pendant cinq versions.
- **C'est de l'échantillonnage.** 8-12 profils sur un espace d'entrées immense.
- **61 constantes sur 142 restent non lues par le miroir.** Le lot C en récupère une partie, pas toutes.
- **La skill reste un assistant de cadrage.** Aucun lot ne la transforme en autorité d'architecture, et c'est délibéré.

---

## 9. Décisions actées

| Point | Décision |
|---|---|
| Nom | `get-migration-assessment` |
| Option | **B** — politique lisible, mesurée, pas de moteur exécuté |
| Seuil | Mesurer d'abord, fixer ensuite |
| KB | Intouchée |
| Weekly check | Conservé, adapté dans le lot C |
| README | Revue complète pour l'alignement v2.0.0 |

## 10. En attente

- [ ] Validation de la séquence en 6 étapes
- [ ] Avis sur le report du pitch développeur (789 lignes) après la v2.0.0
- [ ] Go pour l'étape 1
