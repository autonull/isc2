/* eslint-disable */
import { sign, encode, type Signature } from '@isc/core';
import type { SignedPost, CommunityReport, CommunityCouncil } from './types.ts';
import { getPeerID, getKeypair } from '../identity/index.ts';
import { DelegationClient } from '@isc/delegation';
import { computeReputation } from './graph.ts';
import { getDB, dbGet, dbGetAll, dbPut, dbDelete } from '../db/factory.ts';

const DEFAULT_TTL = 86400 * 30;
const DB_NAME = 'isc-moderation';
const DB_VERSION = 1;
const STORES = ['mutes', 'blocks', 'reports', 'votes', 'councils', 'decisions'];

export function isPostValid(post: { timestamp: number; ttl: number }): boolean {
  return Date.now() < post.timestamp + post.ttl * 1000;
}

export function filterMutedPosts<T extends { author: string }>(posts: T[], muted: string[]): T[] {
  const mutedSet = new Set(muted);
  return posts.filter((post) => !mutedSet.has(post.author));
}

async function getModerationDB(): Promise<IDBDatabase> {
  return getDB(DB_NAME, DB_VERSION, STORES);
}

async function dbGetFrom<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return dbGet<T>(db, store, key);
}

async function dbGetAllFrom<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return dbGetAll<T>(db, store);
}

async function dbPutTo(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  await dbPut(db, store, value);
}

async function dbDeleteFrom(db: IDBDatabase, store: string, key: string): Promise<void> {
  await dbDelete(db, store, key);
}

export async function muteUser(peerID: string): Promise<void> {
  const db = await getModerationDB();
  await dbPutTo(db, 'mutes', { peerID, mutedAt: Date.now() });
}

export async function unmuteUser(peerID: string): Promise<void> {
  const db = await getModerationDB();
  await dbDeleteFrom(db, 'mutes', peerID);
}

export async function getMutedUsers(): Promise<string[]> {
  const db = await getModerationDB();
  const mutes = await dbGetAllFrom<{ peerID: string }>(db, 'mutes');
  return mutes.map((m) => m.peerID);
}

export async function blockUser(peerID: string): Promise<void> {
  const actor = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const blockEvent = { type: 'block' as const, blocker: actor, blocked: peerID, timestamp: Date.now() };
  const signature = await sign(encode(blockEvent), keypair.privateKey);

  const db = await getModerationDB();
  await dbPutTo(db, 'blocks', { peerID, blockedAt: Date.now() });

  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/block/${actor}/${peerID}`, encode({ ...blockEvent, signature }), DEFAULT_TTL);
  }
}

export async function unblockUser(peerID: string): Promise<void> {
  const db = await getModerationDB();
  await dbDeleteFrom(db, 'blocks', peerID);

  const client = DelegationClient.getInstance();
  if (client) {
    const actor = await getPeerID();
    const keypair = getKeypair();
    if (!keypair) return;

    const unblockEvent = { type: 'unblock' as const, blocker: actor, blocked: peerID, timestamp: Date.now() };
    const signature = await sign(encode(unblockEvent), keypair.privateKey);
    await client.announce(`/isc/block/${actor}/${peerID}`, encode({ ...unblockEvent, signature }), 86400);
  }
}

export async function getBlockedUsers(): Promise<string[]> {
  const db = await getModerationDB();
  const blocks = await dbGetAllFrom<{ peerID: string }>(db, 'blocks');
  return blocks.map((b) => b.peerID);
}

export async function isMuted(peerID: string): Promise<boolean> {
  const muted = await getMutedUsers();
  return muted.includes(peerID);
}

export async function isBlocked(peerID: string): Promise<boolean> {
  const blocked = await getBlockedUsers();
  return blocked.includes(peerID);
}

export function filterModeratedPosts(
  posts: SignedPost[],
  muted: string[],
  blocked: string[]
): SignedPost[] {
  const excluded = new Set([...muted, ...blocked]);
  return posts.filter((post) => !excluded.has(post.author));
}

export async function reportUser(
  reported: string,
  reason: string,
  evidence: string[]
): Promise<CommunityReport> {
  const reporter = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const report: Omit<CommunityReport, 'signature'> = {
    id: `report_${crypto.randomUUID()}`,
    reporter,
    reported,
    reason,
    evidence,
    timestamp: Date.now(),
  };

  const signature = await sign(encode(report), keypair.privateKey);
  const signedReport: CommunityReport = { ...report, signature };

  const db = await getModerationDB();
  await dbPutTo(db, 'reports', signedReport);

  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/report/${signedReport.id}`, encode(signedReport), DEFAULT_TTL);
  }

  return signedReport;
}

export async function getPendingReports(): Promise<CommunityReport[]> {
  const db = await getModerationDB();
  const [reports, decisions] = await Promise.all([
    dbGetAllFrom<CommunityReport>(db, 'reports'),
    dbGetAllFrom<{ reportId: string }>(db, 'decisions'),
  ]);

  const decidedIds = new Set(decisions.map((d) => d.reportId));
  return reports.filter((r) => !decidedIds.has(r.id));
}

export async function getReportsForTarget(targetId: string): Promise<CommunityReport[]> {
  const db = await getModerationDB();
  const reports = await dbGetAllFrom<CommunityReport>(db, 'reports');
  return reports.filter((r) => r.reported === targetId || r.evidence.includes(targetId));
}

export async function voteOnReport(reportId: string, decision: 'guilty' | 'not_guilty'): Promise<void> {
  const voter = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const vote = {
    id: `vote_${crypto.randomUUID()}`,
    reportId,
    voter,
    decision,
    timestamp: Date.now(),
  };

  const signature = await sign(encode(vote), keypair.privateKey);
  const db = await getModerationDB();
  await dbPutTo(db, 'votes', { ...vote, signature });
  await processReportDecision(reportId);
}

async function processReportDecision(reportId: string): Promise<void> {
  const db = await getModerationDB();
  const [report, votes] = await Promise.all([
    dbGetFrom<CommunityReport>(db, 'reports', reportId),
    dbGetAllFrom<{ reportId: string; decision: string }>(db, 'votes'),
  ]);

  if (!report) return;

  const reportVotes = votes.filter((v) => v.reportId === reportId);
  const guiltyCount = reportVotes.filter((v) => v.decision === 'guilty').length;
  const notGuiltyCount = reportVotes.filter((v) => v.decision === 'not_guilty').length;
  const threshold = 3;

  if (guiltyCount >= threshold) {
    await dbPutTo(db, 'decisions', { reportId, outcome: 'guilty' as const, decidedAt: Date.now(), voteCount: guiltyCount });
  } else if (notGuiltyCount >= threshold) {
    await dbPutTo(db, 'decisions', { reportId, outcome: 'not_guilty' as const, decidedAt: Date.now(), voteCount: notGuiltyCount });
  }
}

export async function createCouncil(
  name: string,
  jurisdiction: string[],
  members: string[]
): Promise<CommunityCouncil> {
  const creator = await getPeerID();
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const council: Omit<CommunityCouncil, 'signature'> = {
    id: `council_${crypto.randomUUID()}`,
    name,
    members: [...new Set([...members, creator])],
    threshold: Math.ceil(members.length / 2) + 1,
    jurisdiction,
    reputationThreshold: 0.7,
  };

  const signature = await sign(encode(council), keypair.privateKey);
  const signedCouncil: CommunityCouncil = { ...council, signature };

  const db = await getModerationDB();
  await dbPutTo(db, 'councils', signedCouncil);

  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/council/${signedCouncil.id}`, encode(signedCouncil), DEFAULT_TTL);
  }

  return signedCouncil;
}

export async function getCouncil(councilId: string): Promise<CommunityCouncil | null> {
  const db = await getModerationDB();
  return dbGetFrom<CommunityCouncil>(db, 'councils', councilId);
}

export async function getCouncilsForChannel(channelID: string): Promise<CommunityCouncil[]> {
  const db = await getModerationDB();
  const councils = await dbGetAllFrom<CommunityCouncil>(db, 'councils');
  return councils.filter((c) => c.jurisdiction.includes(channelID) || c.jurisdiction.includes('*'));
}

export async function getMyCouncils(): Promise<CommunityCouncil[]> {
  const peerID = await getPeerID();
  const db = await getModerationDB();
  const councils = await dbGetAllFrom<CommunityCouncil>(db, 'councils');
  return councils.filter((c) => c.members.includes(peerID));
}

export async function isCouncilEligible(peerID: string, minReputation: number = 0.7): Promise<boolean> {
  const rep = await computeReputation(peerID);
  return rep.score >= minReputation;
}

export async function blockPeer(peerID: string): Promise<{
  type: 'block';
  blocked: string;
  timestamp: number;
  signature: Signature;
}> {
  await blockUser(peerID);
  const actor = await getPeerID();
  const keypair = getKeypair();
  const blockEvent = { type: 'block' as const, blocker: actor, blocked: peerID, timestamp: Date.now() };
  const signature = keypair ? await sign(encode(blockEvent), keypair.privateKey) : { data: new Uint8Array(), algorithm: 'Ed25519' as const };
  return { ...blockEvent, signature };
}

export async function unblockPeer(peerID: string): Promise<void> {
  await unblockUser(peerID);
}

export async function getBlockedPeers(): Promise<string[]> {
  return getBlockedUsers();
}

export async function submitModerationVote(reportId: string, decision: 'guilty' | 'not_guilty'): Promise<void> {
  await voteOnReport(reportId, decision);
}

export async function processModerationDecision(
  reportId: string,
  councilId: string
): Promise<{ outcome: 'guilty' | 'not_guilty'; voteCount: number } | null> {
  const council = await getCouncil(councilId);
  if (!council) return null;

  const db = await getModerationDB();
  const report = await dbGetFrom<CommunityReport>(db, 'reports', reportId);
  if (!report) return null;

  const votes = await dbGetAllFrom<{ reportId: string; decision: string }>(db, 'votes');
  const reportVotes = votes.filter((v) => v.reportId === reportId);
  const guiltyCount = reportVotes.filter((v) => v.decision === 'guilty').length;
  const notGuiltyCount = reportVotes.filter((v) => v.decision === 'not_guilty').length;

  if (guiltyCount >= council.threshold) {
    return { outcome: 'guilty', voteCount: guiltyCount };
  } else if (notGuiltyCount >= council.threshold) {
    return { outcome: 'not_guilty', voteCount: notGuiltyCount };
  }

  return null;
}
