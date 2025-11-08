/**
 * Message Types and Utilities
 */

import { randomUUID } from 'crypto';

export interface ChatMessage {
  uuid: string;
  type: 'message' | 'acknowledgment';
  content: string;
  timestamp: number;
  fromMagnetLink: string;
  // Channel preferences (included in acknowledgments)
  channelPreferences?: ChannelPreferenceInfo[];
}

export interface ChannelPreferenceInfo {
  protocol: string;
  preferenceOrder?: number; // 1 = most preferred
  cannotUse: boolean;
  customEndpoint?: string; // For user's own servers
}

export interface AcknowledgmentMessage extends ChatMessage {
  type: 'acknowledgment';
  originalMessageUuid: string;
  receivedAt: number;
  receivedVia: string; // Which protocol it was received on
}

export function createChatMessage(
  content: string,
  fromMagnetLink: string
): ChatMessage {
  return {
    uuid: randomUUID(),
    type: 'message',
    content,
    timestamp: Date.now(),
    fromMagnetLink,
  };
}

export function createAcknowledgment(
  originalMessage: ChatMessage,
  receivedVia: string,
  fromMagnetLink: string,
  channelPreferences?: ChannelPreferenceInfo[]
): AcknowledgmentMessage {
  return {
    uuid: randomUUID(),
    type: 'acknowledgment',
    content: `ACK: ${originalMessage.uuid}`,
    timestamp: Date.now(),
    fromMagnetLink,
    originalMessageUuid: originalMessage.uuid,
    receivedAt: Date.now(),
    receivedVia,
    channelPreferences,
  };
}

export function serializeMessage(message: ChatMessage): string {
  return JSON.stringify(message);
}

export function deserializeMessage(data: string): ChatMessage | null {
  try {
    const parsed = JSON.parse(data);

    // Validate required fields
    if (!parsed.uuid || !parsed.type || !parsed.timestamp || !parsed.fromMagnetLink) {
      return null;
    }

    return parsed as ChatMessage;
  } catch (error) {
    return null;
  }
}

export function isAcknowledgment(message: ChatMessage): message is AcknowledgmentMessage {
  return message.type === 'acknowledgment';
}
