import { io } from 'socket.io-client';

export class Global
{
	static socket = io('http://localhost:3001');
	static users: User[] = [];
}

export type User = {
	id: string;
	image: string;
};
