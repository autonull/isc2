/* eslint-disable */
import type { Stream } from '../interfaces/network.js';
import type { SignedAnnouncement } from '../messages.js';
import { encode, decode } from '../encoding.js';

export async function handleAnnounceStream(stream: Stream): Promise<void> {
  try {
    for await (const chunk of stream.source) {
      const announcement = decode(chunk) as SignedAnnouncement;

      const ack = { success: true, channelID: announcement.channelID, timestamp: Date.now() };
      await stream.sink({
        [Symbol.asyncIterator]: function* () {
          yield encode(ack);
        },
      });
    }
  } catch (error) {
    console.error('Error handling announcement stream:', error);
  }
}
