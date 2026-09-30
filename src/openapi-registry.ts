import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ErrorResponseSchema } from '@mairie360/bffs-lib';
import { z } from 'zod';

// Adds the .openapi() methods to Zod.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Credential read by `authorization()` (clients/upstream.ts) and forwarded to Core API. The
// document requires it on every operation (`openapi.ts`); public operations opt out with
// `security: []`. The ZAP OpenAPI coverage gate reads this to tell which operations must be
// reached authenticated.
export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Body of every error answer, shared by every BFF (`@mairie360/bffs-lib`): `{ error: { code, message, details } }`.
// clone(): the lib builds its schemas on import, before extendZodWithOpenApi() above, and zod 4 only
// adds .openapi() to schemas created after the extension.
export const ErrorSchema = registry.register('ErrorResponse', ErrorResponseSchema.clone());
