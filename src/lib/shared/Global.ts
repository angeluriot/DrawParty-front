import { io, Socket } from 'socket.io-client';

export class Global
{
	static socket = io('http://localhost:3001');
	static users = new Map<string, User>();
}

export type User = {
	id: string,
	image: string
};
