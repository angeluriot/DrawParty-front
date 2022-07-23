import type Point from "../Point";

export default class BrushPoint {
	color: string;
	brushSize: number;
	point: Point;
	eraser: boolean;
	pathBegun = false;

	constructor(point: Point, color: string, brushSize: number, eraser: boolean) {
		this.point = point;
		this.color = color;
		this.brushSize = brushSize;
		this.eraser = eraser;
	}

	beginPath(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
		if (this.eraser)
			ctx.globalCompositeOperation = 'destination-out';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.brushSize * canvas.height;
		ctx.moveTo(this.point.x * canvas.width, this.point.y * canvas.height);
		ctx.beginPath();
		this.pathBegun = true;
	}

	lineTo(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, point: Point) {
		if (!this.pathBegun)
			this.beginPath(canvas, ctx);
		ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
	}

	render(ctx: CanvasRenderingContext2D) {
		if (!this.pathBegun)
			return;
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
		this.pathBegun = false;
	}

	drawLine(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, otherPoint: BrushPoint): void {
		if (this.eraser)
			ctx.globalCompositeOperation = 'destination-out';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.brushSize * canvas.height;
		ctx.beginPath();
		ctx.moveTo(this.point.x * canvas.width, this.point.y * canvas.height);
		ctx.lineTo(otherPoint.point.x * canvas.width, otherPoint.point.y * canvas.height);
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
	}
}
