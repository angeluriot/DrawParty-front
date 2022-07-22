import type Point from "../Point";
import FloodFill from 'q-floodfill'

export default class Fill {
	color: string;
	point: Point;

	constructor(point: Point, color: string) {
		this.point = point;
		this.color = color;
	}

	render(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
		const floodFill = new FloodFill(ctx.getImageData(0, 0, canvas.width, canvas.height));
		floodFill.fill(this.color, Math.floor(this.point.x * canvas.width), Math.floor(this.point.y * canvas.height), 0);
		ctx.putImageData(floodFill.imageData, 0, 0);
	}
}
