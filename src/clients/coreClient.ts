import { getCoreAPIMairie360 } from '@mairie360/core-api-openapi/endpoints/coreAPIMairie360';
import axios from 'axios';

// Core API is only called through the operations of its published contract (@mairie360/core-api-openapi).
// No baseURL here: every call passes the lib's `asCaller('CORE_API', req)` or `withoutSession('CORE_API')`,
// which read CORE_API_URL / CORE_API_PORT on every call (503 when missing).
const coreAxios = axios.create({ headers: { Accept: 'application/json' } });

export const coreApi = getCoreAPIMairie360(coreAxios);
