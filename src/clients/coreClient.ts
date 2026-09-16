import { getCoreApi } from '@mairie360/core-api-openapi/endpoints/coreApi';
import axios, { type AxiosRequestConfig } from 'axios';
import type { Request } from 'express';
import { ZodError } from 'zod';
import { authorization, baseUrl, UpstreamError } from './upstream';

// Core API n'est appelée que par les opérations de son contrat publié (@mairie360/core-api-openapi).
const coreAxios = axios.create({ timeout: 10_000, headers: { Accept: 'application/json' } });

export const coreApi = getCoreApi(coreAxios);

/**
 * Options d'un appel Core au nom de l'appelant. L'URL est relue à chaque requête (les variables
 * d'environnement peuvent changer sans redémarrage) ; un appelant sans session est refusé avant l'appel.
 */
export function asCaller(req: Request): AxiosRequestConfig {
  return {
    baseURL: baseUrl('CORE_API'),
    headers: { Authorization: authorization(req) },
  };
}

/** Options d'un appel sans session (sondes de disponibilité). */
export function withoutSession(timeout = 5_000): AxiosRequestConfig {
  return { baseURL: baseUrl('CORE_API'), timeout };
}

/**
 * Un 4xx amont est conservé, une panne amont (5xx) devient un 502 sans relayer son corps, une panne
 * réseau un 502 « indisponible », et une réponse inexploitable (JSON invalide, champs manquants) un
 * 502 « réponse invalide ».
 */
export function coreError(error: unknown): unknown {
  if (error instanceof UpstreamError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) return new UpstreamError(502, 'Le service CORE_API est indisponible.');
    return new UpstreamError(status >= 500 ? 502 : status, `Le service CORE_API a répondu ${status}.`);
  }
  if (error instanceof ZodError) return new UpstreamError(502, 'La réponse de CORE_API est invalide.');
  return error;
}
