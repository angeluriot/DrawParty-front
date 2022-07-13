import Point from "./Point";
import Global from "../shared/global";

/*

Base usage of DrawActions :

Every action: brush, bucket, etc. is defined by its own class that implements DrawAction
Child classes are constructed when user hold down the click.

They handle the rest of their events by themself.
For example, in the case of the brush, we need a mousemove to update the path, and a mouseup to know when to stop tracing the path

*/

// Base interface to be able to use each DrawAction just with a .draw
export interface DrawAction {
	draw: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
}


// Brush tool, we can change the brush's size and it's color
export class BrushAction implements DrawAction {
	/* The minimum distance in pixels^2 required between two points of the path
	it prevents short paths from having thousands of points */
	readonly drawDistanceThreshold = 4

	color: string;
	size: number;

	// The path traced by the user with his mouse, to draw the path, we trace a line between each of it's points
	path: Point[] = [];

	// Canvas' borders, it's used to calibrate mouse coordinates in the canvas
	private boundingRect: DOMRect;

	constructor(canvas: HTMLCanvasElement, color: string, size: number, point: Point, {listenToEvents = true} = {}) {
		this.color = color;
		this.size = size;
		this.boundingRect = canvas.getBoundingClientRect();


		// To create a point when there is only one click and no mousemove
		this.path.push(point);
		this.path.push(point);

		if (listenToEvents) {
			canvas.addEventListener('mousemove', this.onMouseMove);
			canvas.addEventListener('mouseup', this.onMouseUp);
			canvas.addEventListener('mouseleave', this.onMouseExit);
		}
	}

	// When the mouse goes out of the canvas, we stop listening to events and stop tracing the path
	private onMouseExit = (e: MouseEvent) => {
		this.stop(e.currentTarget);
	}

	// When the user releases the click, we stop listening to events and stop tracing the path
	private onMouseUp = (e: MouseEvent) => {
		this.stop(e.currentTarget);
	}

	private onMouseMove = (e: MouseEvent) => {
		const point = new Point(e.clientX, e.clientY).toRectSpace(this.boundingRect);
		if (this.path.length > 0 && this.path[this.path.length - 1].distanceSquared(point) < this.drawDistanceThreshold)
			return;
		this.path.push(point);
		Global.socket.emit('updateBrush', {points: [point]});
	}

	stop(target: EventTarget) : void {
		target.removeEventListener('mousemove', this.onMouseMove);
		target.removeEventListener('mouseup', this.onMouseUp);
		target.removeEventListener('mouseleave', this.onMouseExit);
	}

	draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
		if (this.path.length > 0) {
			ctx.lineWidth = this.size;
			ctx.strokeStyle = this.color;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(this.path[0].x, this.path[0].y);
			for (let i = 1; i < this.path.length; i++)
				ctx.lineTo(this.path[i].x, this.path[i].y);
			ctx.stroke();
		}
	}
}
