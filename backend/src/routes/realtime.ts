import { EventEmitter } from "events";
import type { Response } from "express";

type HubEvent = { event: string; data: unknown; userId?: string; conversationId?: string };

class RealtimeHub extends EventEmitter {
  private clients = new Map<string, Set<Response>>();

  add(userId: string, res: Response) {
    if (!this.clients.has(userId)) this.clients.set(userId, new Set());
    this.clients.get(userId)!.add(res);
  }

  remove(userId: string, res: Response) {
    this.clients.get(userId)?.delete(res);
  }

  send(userId: string, payload: HubEvent) {
    const set = this.clients.get(userId);
    if (!set) return;
    const chunk = `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
    for (const res of set) {
      res.write(chunk);
    }
  }

  broadcastToConversation(memberIds: string[], payload: HubEvent) {
    for (const id of memberIds) this.send(id, payload);
  }
}

export const realtime = new RealtimeHub();
