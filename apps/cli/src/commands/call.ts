/**
 * Call Commands (Audio-only for CLI)
 * 
 * - call: Start audio call
 * - call end: End current call
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { CLIConfig } from '../config.js';

interface CallState {
  active: boolean;
  peerId: string;
  startedAt: number;
  type: 'audio';
}

const CALL_STATE_FILE = './isc-call-state.json';

export function callCommands(program: Command): void {
  const call = program.command('call').description('Audio calls');

  // Start call
  call
    .command('<peerId>')
    .description('Start audio call with peer')
    .action((peerId: string) => {
      try {
        // Check if call already active
        if (fs.existsSync(CALL_STATE_FILE)) {
          const state: CallState = JSON.parse(fs.readFileSync(CALL_STATE_FILE, 'utf-8'));
          if (state.active) {
            console.log(`Already in call with @${state.peerId}`);
            console.log('End current call: isc call end');
            return;
          }
        }
        
        const state: CallState = {
          active: true,
          peerId,
          startedAt: Date.now(),
          type: 'audio',
        };
        
        fs.writeFileSync(CALL_STATE_FILE, JSON.stringify(state, null, 2));
        
        console.log('✓ Call initiated');
        console.log(`  Calling: @${peerId}`);
        console.log('  Type: Audio');
        console.log('\nWaiting for connection...');
        console.log('(In production, would establish WebRTC connection)');
        console.log('\nEnd call: isc call end');
        
      } catch (error) {
        console.error('Failed to start call:', error);
        process.exit(1);
      }
    });

  // End call
  call
    .command('end')
    .description('End current call')
    .action(() => {
      try {
        if (!fs.existsSync(CALL_STATE_FILE)) {
          console.log('No active call');
          return;
        }
        
        const state: CallState = JSON.parse(fs.readFileSync(CALL_STATE_FILE, 'utf-8'));
        
        if (!state.active) {
          console.log('No active call');
          fs.unlinkSync(CALL_STATE_FILE);
          return;
        }
        
        const duration = Date.now() - state.startedAt;
        const durationMin = Math.floor(duration / 60000);
        const durationSec = Math.floor((duration % 60000) / 1000);
        
        state.active = false;
        fs.writeFileSync(CALL_STATE_FILE, JSON.stringify(state, null, 2));
        fs.unlinkSync(CALL_STATE_FILE);
        
        console.log('✓ Call ended');
        console.log(`  With: @${state.peerId}`);
        console.log(`  Duration: ${durationMin}m ${durationSec}s`);
        
      } catch (error) {
        console.error('Failed to end call:', error);
        process.exit(1);
      }
    });

  // Call status
  call
    .command('status')
    .description('Show call status')
    .action(() => {
      try {
        if (!fs.existsSync(CALL_STATE_FILE)) {
          console.log('No active call');
          return;
        }
        
        const state: CallState = JSON.parse(fs.readFileSync(CALL_STATE_FILE, 'utf-8'));
        
        if (!state.active) {
          console.log('No active call');
          return;
        }
        
        const duration = Date.now() - state.startedAt;
        const durationMin = Math.floor(duration / 60000);
        const durationSec = Math.floor((duration % 60000) / 1000);
        
        console.log('Active Call');
        console.log(`  With: @${state.peerId}`);
        console.log(`  Type: ${state.type}`);
        console.log(`  Duration: ${durationMin}m ${durationSec}s`);
        
      } catch (error) {
        console.error('Failed to get call status:', error);
        process.exit(1);
      }
    });
}
