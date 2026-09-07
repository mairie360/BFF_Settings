# BFF_Settings — Module overview

[Technical documentation](technical.md) · [Français](../fr/module.md) · [README](../../README.md)

Provide the personal profile and session list for the settings interface. The BFF exposes explicit Core fields and confirms a save by reading back the stored profile.

## Audience and value

Users updating their contact details and inspecting their sessions.

Business domain: Personal settings.

## Available capabilities

- Load profile and sessions with separate session availability.
- Partially update first name, last name, email and phone.
- Notification, appearance and general preference adapters when Core provides them.

## Typical workflow

1. Load `/settings/bootstrap`.
2. Edit contact details and submit `/settings/profile`.
3. Display the profile read back from Core and inspect available sessions.

## Role within Mairie360

Associated repositories: [Settings_Web_Service](https://github.com/mairie360/Settings_Web_Service).

This repository contains the BFF server and its contract. Associated web services own the screens; the BFF adapts data and server rules needed by those screens.

## Data and current state

The profile comes from Core `/api/v1/user/me/`; sessions come from `/api/v1/sessions/`. Fields are `first_name`, `last_name`, `email` and `phone`. The session schema retains displayable information and removes internal fields. The BFF stores no preferences locally.

## Scope and limitations

The web service’s notifications, appearance, general and system panels currently report unavailability. Security displays sessions without managing other settings. Preference adapters do not guarantee that the corresponding Core routes are deployed.

## Developing or operating this module

The [technical guide](technical.md) covers architecture, configuration, routes, session handling, persistence, tests and CI/CD. It describes sources of truth and contract synchronization with associated repositories.
