import type { GameSettings } from '@mastermind/shared';
import { generateRoomCode } from '@mastermind/shared';
import { Room } from './room.js';

export class RoomManager {
  private rooms = new Map<string, Room>();

  create(settings: GameSettings, broadcast: (roomCode: string) => void): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }
    const room = new Room(code, settings, () => broadcast(code));
    this.rooms.set(code, room);
    return room;
  }

  get(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  remove(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    room?.destroy();
    this.rooms.delete(roomCode);
  }
}
