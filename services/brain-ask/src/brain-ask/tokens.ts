export const QMD_CLIENT = Symbol("QMD_CLIENT");
export const MODEL_CLIENT = Symbol("MODEL_CLIENT");
export const FETCH_IMPL = Symbol("FETCH_IMPL");

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
