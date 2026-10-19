# BFF_Settings — Module overview

[Technical documentation](technical.md) · [Français](../fr/module.md) · [README](../../README.md)

Provide the personal profile and session list for the settings interface. The BFF exposes explicit Core fields and confirms a save by reading back the stored profile.

## Audience and value

Users updating their contact details and inspecting their sessions.

Business domain: Personal settings.

## Available capabilities

- Load profile and sessions with separate session availability.
- Partially update first name, last name, email and phone (with its country).
- Notification, appearance and general preferences, read and saved through Core API.

## Typical workflow

1. Load `/settings/bootstrap`.
2. Edit contact details and submit `/settings/profile`.
3. Display the profile read back from Core and inspect available sessions.

## Role within Mairie360

Associated repositories: [Settings_Web_Service](https://github.com/mairie360/Settings_Web_Service).

This repository contains the BFF server and its contract. Associated web services own the screens; the BFF adapts data and server rules needed by those screens.

## Data and current state

The profile comes from Core `/api/v1/user/me/`; sessions come from `/api/v1/sessions/`. Fields are `first_name`, `last_name`, `email`, `phone` and `phone_country`. The session schema retains displayable information and removes internal fields. Preferences come from Core `/api/v1/user/me/preferences/` (appearance and general) and `/api/v1/user/me/notifications/`; the BFF stores no preferences locally.

## Scope and limitations

The system panel of the web service reports unavailability. Security displays sessions without managing other settings.

## Developing or operating this module

The [technical guide](technical.md) covers architecture, configuration, routes, session handling, persistence, tests and CI/CD. It describes sources of truth and contract synchronization with associated repositories.
