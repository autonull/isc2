import type { Stream } from '../interfaces/network.js';
import type { DelegateRequest, DelegateResponse } from '../messages.js';
import { encode, decode } from '../encoding.js';

export async function handleDelegateStream(stream: Stream): Promise<void> {
  try {
    for await (const chunk of stream.source) {
      const request = decode(chunk) as DelegateRequest;
      console.log('Handling delegate request:', request.requestID);

      const response = await handleDelegateRequest(request);
      await stream.sink({
        [Symbol.asyncIterator]: async function* () {
          yield encode(response);
        },
      });
    }
  } catch (error) {
    console.error('Error handling delegate stream:', error);
  }
}

async function handleDelegateRequest(request: DelegateRequest): Promise<DelegateResponse> {
  console.log('Processing delegate request:', request.requestID);

  return {
    type: 'delegate_response',
    requestID: request.requestID,
    service: request.service,
    payload: new Uint8Array(),
    responderPubKey: new Uint8Array(),
    timestamp: Date.now(),
    signature: new Uint8Array(),
  };
}
