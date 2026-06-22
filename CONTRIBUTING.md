# Contribuer à TicketFlow

## Workflow Git

- La branche `main` est **protégée** : pas de push direct.
- Toute modification passe par une **Pull Request** depuis une branche dédiée.
- Une PR nécessite : **1 review** + **CI verte** (build + tests) avant merge.

### Nommage des branches

```
feat/<sujet>      nouvelle fonctionnalité
fix/<sujet>       correction de bug
chore/<sujet>     outillage, config, infra
docs/<sujet>      documentation
```

### Commits (Conventional Commits)

```
feat(api): ajoute la complétion de défi
fix(worker): corrige le recalcul de streak
chore(infra): ajoute le HPA de l'API
```

## Suivi via GitHub Issues

Une **issue par fonctionnalité** (templates dans `.github/ISSUE_TEMPLATE/`).
Lier chaque PR à son issue (`Closes #12`).

## Protéger `main` (à configurer une fois le repo créé)

Settings → Branches → Add rule sur `main` :
- Require a pull request before merging (≥ 1 approval)
- Require status checks to pass (sélectionner le job CI)
- Do not allow bypassing the above settings
