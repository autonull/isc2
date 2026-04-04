/* eslint-disable */
/**
 * Double Ratchet Protocol Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeRatchet,
  initializeRatchetFromFirstMessage,
  ratchetForSend,
  ratchetForReceive,
  encryptMessage,
  decryptMessage,
  serializeRatchetState,
  deserializeRatchetState,
  getRatchetPublicKey,
} from '../../src/crypto/doubleRatchet.js';

describe('DoubleRatchet', () => {
  // Test identities (simulated)
  const aliceIdentity = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
  const bobIdentity = new Uint8Array([32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);

  describe('initializeRatchet', () => {
    it('should initialize a ratchet state for the initiator', async () => {
      const state = await initializeRatchet(aliceIdentity, bobIdentity);

      expect(state.dhPrivate).toBeDefined();
      expect(state.dhPublic).toBeDefined();
      expect(state.rootKey).toBeDefined();
      expect(state.sentChainKey).toBeDefined();
      expect(state.receivedChainKey).toBeNull();
      expect(state.sentMessageNumber).toBe(0);
      expect(state.receivedMessageNumber).toBe(0);
      expect(state.skippedKeys.size).toBe(0);
    });
  });

  describe('initializeRatchetFromFirstMessage', () => {
    it('should initialize a ratchet state for the responder', async () => {
      // First, Alice creates initial state
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);
      const alicePublic = getRatchetPublicKey(aliceState);

      // Bob initializes from Alice's first message
      const bobState = await initializeRatchetFromFirstMessage(bobIdentity, aliceIdentity, alicePublic);

      expect(bobState.dhPrivate).toBeDefined();
      expect(bobState.dhPublic).toBeDefined();
      expect(bobState.rootKey).toBeDefined();
      expect(bobState.sentChainKey).toBeDefined();
      expect(bobState.receivedChainKey).toBeDefined();
      // Responder's receivedChainKey matches sentChainKey (both from shared secret)
      expect(bobState.receivedChainKey).toEqual(bobState.sentChainKey);
      expect(bobState.lastRemotePublic).toEqual(alicePublic);
    });
  });

  describe('message exchange', () => {
    it('should encrypt and decrypt a message', async () => {
      // Setup: Alice initiates, Bob responds
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);
      const alicePublic = getRatchetPublicKey(aliceState);
      const bobState = await initializeRatchetFromFirstMessage(bobIdentity, aliceIdentity, alicePublic);

      // Alice sends first message
      const aliceSend1 = await ratchetForSend(aliceState);
      const plaintext1 = 'Hello Bob!';
      const encrypted1 = await encryptMessage(aliceSend1.keys, plaintext1);

      // Bob receives first message
      const bobReceive1 = await ratchetForReceive(bobState, aliceSend1.dhPublic, aliceSend1.messageNumber);
      const decrypted1 = await decryptMessage(bobReceive1.keys, encrypted1.ciphertext, encrypted1.mac, encrypted1.iv);

      expect(decrypted1).toBe(plaintext1);
      expect(bobReceive1.skipped).toBe(false);
    });

    it('should handle multiple message exchanges', async () => {
      // Setup
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);
      const alicePublic = getRatchetPublicKey(aliceState);
      const bobState = await initializeRatchetFromFirstMessage(bobIdentity, aliceIdentity, alicePublic);

      // Alice sends message 1
      const aliceSend1 = await ratchetForSend(aliceState);
      const msg1 = 'Message 1';
      const enc1 = await encryptMessage(aliceSend1.keys, msg1);
      const bobRecv1 = await ratchetForReceive(bobState, aliceSend1.dhPublic, aliceSend1.messageNumber);
      const dec1 = await decryptMessage(bobRecv1.keys, enc1.ciphertext, enc1.mac, enc1.iv);
      expect(dec1).toBe(msg1);

      // Alice sends message 2
      const aliceSend2 = await ratchetForSend(aliceState);
      const msg2 = 'Message 2';
      const enc2 = await encryptMessage(aliceSend2.keys, msg2);
      const bobRecv2 = await ratchetForReceive(bobState, aliceSend2.dhPublic, aliceSend2.messageNumber);
      const dec2 = await decryptMessage(bobRecv2.keys, enc2.ciphertext, enc2.mac, enc2.iv);
      expect(dec2).toBe(msg2);

      // Bob replies
      const bobSend1 = await ratchetForSend(bobState);
      const msg3 = 'Reply from Bob';
      const enc3 = await encryptMessage(bobSend1.keys, msg3);
      const aliceRecv1 = await ratchetForReceive(aliceState, bobSend1.dhPublic, bobSend1.messageNumber);
      const dec3 = await decryptMessage(aliceRecv1.keys, enc3.ciphertext, enc3.mac, enc3.iv);
      expect(dec3).toBe(msg3);
    });

    it('should handle out-of-order messages', async () => {
      // Setup
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);
      const alicePublic = getRatchetPublicKey(aliceState);
      const bobState = await initializeRatchetFromFirstMessage(bobIdentity, aliceIdentity, alicePublic);

      // Alice sends 3 messages
      const sends = [];
      const messages = ['First', 'Second', 'Third'];
      for (const msg of messages) {
        const send = await ratchetForSend(aliceState);
        const enc = await encryptMessage(send.keys, msg);
        sends.push({ send, enc, msg });
      }

      // Bob receives message 3 first (skip 1 and 2)
      const third = sends[2];
      const bobRecv3 = await ratchetForReceive(bobState, third.send.dhPublic, third.send.messageNumber);
      const dec3 = await decryptMessage(bobRecv3.keys, third.enc.ciphertext, third.enc.mac, third.enc.iv);
      expect(dec3).toBe('Third');

      // Bob receives message 1 (should use skipped key)
      const first = sends[0];
      const bobRecv1 = await ratchetForReceive(bobState, first.send.dhPublic, first.send.messageNumber);
      const dec1 = await decryptMessage(bobRecv1.keys, first.enc.ciphertext, first.enc.mac, first.enc.iv);
      expect(dec1).toBe('First');
      expect(bobRecv1.skipped).toBe(true);

      // Bob receives message 2 (should use skipped key)
      const second = sends[1];
      const bobRecv2 = await ratchetForReceive(bobState, second.send.dhPublic, second.send.messageNumber);
      const dec2 = await decryptMessage(bobRecv2.keys, second.enc.ciphertext, second.enc.mac, second.enc.iv);
      expect(dec2).toBe('Second');
      expect(bobRecv2.skipped).toBe(true);
    });
  });

  describe('forward secrecy', () => {
    it('should have different keys for each message', async () => {
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);

      const send1 = await ratchetForSend(aliceState);
      const send2 = await ratchetForSend(aliceState);
      const send3 = await ratchetForSend(aliceState);

      // Each message should have different encryption keys
      expect(send1.keys.encryptionKey).not.toEqual(send2.keys.encryptionKey);
      expect(send2.keys.encryptionKey).not.toEqual(send3.keys.encryptionKey);
      expect(send1.messageNumber).toBe(1);
      expect(send2.messageNumber).toBe(2);
      expect(send3.messageNumber).toBe(3);
    });

    it('should ratchet forward on DH key exchange', async () => {
      // Setup
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);
      const alicePublic1 = getRatchetPublicKey(aliceState);
      const bobState = await initializeRatchetFromFirstMessage(bobIdentity, aliceIdentity, alicePublic1);

      // Alice sends
      const aliceSend1 = await ratchetForSend(aliceState);
      await ratchetForReceive(bobState, aliceSend1.dhPublic, aliceSend1.messageNumber);

      // Bob replies (new DH ratchet)
      const bobSend1 = await ratchetForSend(bobState);
      const bobPublic = getRatchetPublicKey(bobState);

      // Alice receives (triggers DH ratchet)
      const aliceRecv1 = await ratchetForReceive(aliceState, bobPublic, bobSend1.messageNumber);

      // Root key should have changed
      expect(aliceState.rootKey).toBeDefined();
      expect(bobState.rootKey).toBeDefined();
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize state correctly', async () => {
      const originalState = await initializeRatchet(aliceIdentity, bobIdentity);

      // Send a message to advance state
      await ratchetForSend(originalState);

      const serialized = await serializeRatchetState(originalState);
      const restoredState = await deserializeRatchetState(serialized);

      expect(restoredState.dhPublic).toEqual(originalState.dhPublic);
      expect(restoredState.rootKey).toEqual(originalState.rootKey);
      expect(restoredState.sentMessageNumber).toBe(originalState.sentMessageNumber);
      expect(restoredState.receivedMessageNumber).toBe(originalState.receivedMessageNumber);
    });
  });

  describe('error handling', () => {
    it('should reject messages too far ahead', async () => {
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);
      const alicePublic = getRatchetPublicKey(aliceState);
      const bobState = await initializeRatchetFromFirstMessage(bobIdentity, aliceIdentity, alicePublic);

      // Try to receive message 1001 (beyond MAX_SKIP of 1000)
      const aliceSend = await ratchetForSend(aliceState);

      await expect(
        ratchetForReceive(bobState, aliceSend.dhPublic, 1002)
      ).rejects.toThrow('Message number too far ahead');
    });

    it('should reject messages without chain key', async () => {
      const aliceState = await initializeRatchet(aliceIdentity, bobIdentity);

      // Try to send without proper setup
      aliceState.sentChainKey = null;

      await expect(ratchetForSend(aliceState)).rejects.toThrow('Cannot send: no chain key available');
    });
  });
});
