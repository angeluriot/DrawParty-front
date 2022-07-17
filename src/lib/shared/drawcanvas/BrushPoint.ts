import type Point from "../Point";

export default class BrushPoint {
	color: string;
	brushSize: number;
	point: Point;
	eraser: boolean;

	constructor(point: Point, color: string, brushSize: number, eraser: boolean) {
		this.point = point;
		this.color = color;
		this.brushSize = brushSize;
		this.eraser = eraser;
	}

	drawLine(canvas, ctx: CanvasRenderingContext2D, otherPoint: BrushPoint): void {
		if (this.eraser)
			ctx.globalCompositeOperation = 'destination-out';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.brushSize;
		ctx.beginPath();
		ctx.moveTo(this.point.x * canvas.width, this.point.y * canvas.height);
		ctx.lineTo(otherPoint.point.x * canvas.width, otherPoint.point.y * canvas.height);
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
	}
}
