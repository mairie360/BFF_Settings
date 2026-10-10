# BFF_Settings — Présentation du module

[Documentation technique](technical.md) · [English](../en/module.md) · [README](../../README.md)

Fournir le profil personnel et la liste des sessions pour l’interface de paramètres. Le BFF expose les champs Core explicites et confirme une sauvegarde en relisant le profil enregistré.

## Public et utilité

Les utilisateurs qui mettent à jour leurs coordonnées et consultent leurs sessions.

Domaine fonctionnel: Paramètres personnels.

## Fonctions disponibles

- Chargement du profil et des sessions, avec disponibilité des sessions séparée.
- Modification partielle du prénom, nom, e-mail et téléphone (avec son pays).
- Préférences notifications, apparence et général, lues et enregistrées via Core API.

## Parcours type

1. Charger `/settings/bootstrap`.
2. Modifier les coordonnées et transmettre `/settings/profile`.
3. Afficher le profil relu depuis Core et consulter les sessions disponibles.

## Place dans Mairie360

Dépôts associés: [Settings_Web_Service](https://github.com/mairie360/Settings_Web_Service).

Ce dépôt contient le serveur BFF et son contrat. Les web services associés portent les écrans; le BFF adapte les données et les règles serveur nécessaires à ces écrans.

## Données et état actuel

Le profil vient de Core `/api/v1/user/me/`; les sessions viennent de `/api/v1/sessions/`. Les champs sont `first_name`, `last_name`, `email`, `phone` et `phone_country`. Le schéma des sessions ne conserve que les informations affichables et retire les champs internes. Les préférences viennent de Core `/api/v1/user/me/preferences/` (apparence et général) et `/api/v1/user/me/notifications/` ; aucune préférence n’est stockée localement par le BFF.

## Périmètre et limites

Le panneau système du web service indique son indisponibilité. La sécurité affiche les sessions, sans gérer les autres réglages.

## Pour développer ou exploiter ce module

Le [guide technique](technical.md) détaille architecture, configuration, routes, session, persistance, tests et CI/CD. Il décrit les sources de vérité et les étapes de synchronisation des contrats avec les dépôts associés.
