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

	// Pour recalibrer un point selon un offset
	toRectSpace(rect: DOMRect): Point {
		return new Point((this.x - rect.left) / rect.width, (this.y - rect.top) / rect.height);
	}
}
