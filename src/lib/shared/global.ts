import { io, Socket } from 'socket.io-client';

export default class Global {
	static socket: Socket = io('http://localhost:3001');
}
