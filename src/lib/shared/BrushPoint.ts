import type Point from "./Point";

export default class BrushPoint {
	color: string;
	brushSize: number;
	point: Point;

	constructor(point: Point, color: string, brushSize: number) {
		this.point = point;
		this.color = color;
		this.brushSize = brushSize;
	}

	drawLine(canvas, ctx: CanvasRenderingContext2D, otherPoint: BrushPoint): void {
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.brushSize;
		ctx.beginPath();
		ctx.moveTo(this.point.x * canvas.width, this.point.y * canvas.height);
		ctx.lineTo(otherPoint.point.x * canvas.width, otherPoint.point.y * canvas.height);
		ctx.stroke();
	}
}
