import { io, Socket } from 'socket.io-client';

export default class Global {
	static socket: Socket = io('http://localhost:3001');

	static arrayMove(arr, oldIndex: number, newIndex: number): void {
		if (newIndex >= arr.length) {
			var k = newIndex - arr.length + 1;
			while (k--) {
				arr.push(undefined);
			}
		}
		arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
	}
}
