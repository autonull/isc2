export interface EmbedRequest {
  text: string;
  model: string;
}

export interface EmbedResponse {
  embedding: number[];
  model: string;
  norm: number;
}

export interface ANNQueryRequest {
  query: number[];
  k: number;
  modelHash: string;
}

export interface ANNQueryResponse {
  matches: string[];
  scores: number[];
}

export interface SigVerifyRequest {
  payload: Uint8Array;
  signature: Uint8Array;
  publicKey: Uint8Array;
}

export interface SigVerifyResponse {
  valid: boolean;
}

export type ServiceRequest = EmbedRequest | ANNQueryRequest | SigVerifyRequest;
export type ServiceResponse = EmbedResponse | ANNQueryResponse | SigVerifyResponse;

export function parseServiceRequest(
  service: 'embed' | 'ann_query' | 'sig_verify',
  payload: Uint8Array
): ServiceRequest {
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(payload);

  switch (service) {
    case 'embed':
      return JSON.parse(jsonStr) as EmbedRequest;
    case 'ann_query':
      return JSON.parse(jsonStr) as ANNQueryRequest;
    case 'sig_verify':
      return JSON.parse(jsonStr) as SigVerifyRequest;
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}

export function serializeServiceResponse(
  _service: 'embed' | 'ann_query' | 'sig_verify',
  response: ServiceResponse
): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(response));
}

export function validateEmbedRequest(req: EmbedRequest): boolean {
  return (
    typeof req.text === 'string' &&
    req.text.length > 0 &&
    typeof req.model === 'string' &&
    req.model.length > 0
  );
}

export function validateANNQueryRequest(req: ANNQueryRequest): boolean {
  return (
    Array.isArray(req.query) &&
    req.query.length === 384 &&
    req.query.every((n) => typeof n === 'number' && !isNaN(n)) &&
    typeof req.k === 'number' &&
    req.k >= 1 &&
    req.k <= 100 &&
    typeof req.modelHash === 'string'
  );
}

export function validateSigVerifyRequest(req: SigVerifyRequest): boolean {
  const isValidArray = (arr: any): boolean => {
    if (arr instanceof Uint8Array) return true;
    if (Array.isArray(arr) && arr.every((v) => typeof v === 'number')) return true;
    return false;
  };
  return isValidArray(req.payload) && isValidArray(req.signature) && isValidArray(req.publicKey);
}
