import Point from "./Point";

export interface DrawAction {
	draw: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
}

export class BrushAction implements DrawAction {
	readonly drawDistanceThreshold = 4

	color: string;
	size: number;
	path: Point[] = [];

	private boundingRect: DOMRect;

	constructor(canvas: HTMLCanvasElement, color: string, size: number) {
		this.color = color;
		this.size = size;
		this.boundingRect = canvas.getBoundingClientRect();
		canvas.addEventListener('mousemove', this.onMouseMove);
		canvas.addEventListener('mouseup', this.onMouseUp);
	}

	private onMouseMove = (e: MouseEvent) => {
		const point = new Point(e.clientX, e.clientY).toRectSpace(this.boundingRect);
		if (this.path.length > 0 && this.path[this.path.length - 1].distanceSquared(point) < this.drawDistanceThreshold)
			return;
		this.path.push(point);
	}

	private onMouseUp = (e: MouseEvent) => {
		e.currentTarget.removeEventListener('mousemove', this.onMouseMove);
		e.currentTarget.removeEventListener('mouseup', this.onMouseUp)
	}

	draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
		if (this.path.length > 0) {
			ctx.lineWidth = this.size;
			ctx.strokeStyle = this.color;
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo(this.path[0].x, this.path[0].y);
			for (let i = 1; i < this.path.length; i++)
				ctx.lineTo(this.path[i].x, this.path[i].y);
			ctx.stroke();
		}
	}
}
