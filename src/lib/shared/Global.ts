import { io } from 'socket.io-client';
import type { Player } from './Player';

export class Global
{
	static socket = io('http://localhost:3001');
	static connected: boolean = false;
	static partyId: string | null = null;
	static players: Player[] = [];

	static getPlayer(id: string)
	{
		let player = Global.players.find(player => player.id === id);

		if (player === undefined)
			return null;

		return player;
	}
}
