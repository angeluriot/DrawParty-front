import { io, Socket } from 'socket.io-client';
import Point from './Point';

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

	static lineLineIntersection(a: Point, b: Point, c: Point, d: Point)
	{
		const a1 = b.y - a.y;
		const b1 = a.x - b.x;
		const c1 = a1 * a.x + b1 * a.y;

		const a2 = d.y - c.y;
		const b2 = c.x - d.x;
		const c2 = a2 * c.x + b2 * c.y;

		const determinant = a1*b2 - a2*b1;
		if (determinant == 0)
			return new Point(Number.NaN, Number.NaN);
		else
			return new Point((b2 * c1 - b1 * c2) / determinant, ( a1 * c2 - a2 * c1) / determinant);
	}
}
