export default class Point {
	x: number;
	y: number;
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	distanceSquared(other: Point) : number {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		return dx * dx + dy * dy;
	}

	distance(other: Point) : number {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	toRectSpace(rectangle: DOMRect): Point {
		return new Point(this.x - rectangle.left, this.y - rectangle.top);
	}
}