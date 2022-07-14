import type Point from "./Point";

export default class BrushPoint {
	pathId: number;
	color: string;
	brushSize: number;
	point: Point;

	constructor(pathId: number, point: Point, color: string, brushSize: number) {
		this.pathId = pathId;
		this.point = point;
		this.color = color;
		this.brushSize = brushSize;
	}

	drawLine(ctx: CanvasRenderingContext2D, otherPoint: BrushPoint): void {
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.brushSize;
		ctx.beginPath();
		ctx.moveTo(this.point.x, this.point.y);
		ctx.lineTo(otherPoint.point.x, otherPoint.point.y);
		ctx.stroke();
	}
}
