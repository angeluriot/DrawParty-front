import Action from "./Action";
import BrushPoint from "./BrushPoint";
import type Point from "../Point";

export default class LocalDraw {
	/*
	The minimum normalized distance between two points of a path
	it is used to prevent small paths from having too many points
	*/
	readonly drawDistanceThreshold = 0.000006

	// This is the list of all current actions that hasn't been confirmed by the server yet
	actionStack: Action[] = [];
	undos: number[] = [];

	/*
	The current amount of local actions (creating a path, filling, ...).
	It is used to create group ids for actions, in the case an action is dependant of an other
	(like updatePath that adds a point to an already existing action)
	When undoing, all the actions with a certain id are deleted. This is how we remove all points of a path
	*/
	totalActions = 0;

	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
		this.canvas = canvas;
	}


	createBrush(point: Point, color: string, size: number, eraser: boolean): void {
		const brushPoint = new BrushPoint(point, color, size, eraser);
		const action = new Action('brushPoint', brushPoint, this.totalActions++);
		this.actionStack.push(action);
		this.actionStack.push(action);
		brushPoint.drawLine(this.canvas, this.ctx, brushPoint);
	}

	addPoint(point: Point, lastPoint: BrushPoint, pathId: number): boolean {
		if (lastPoint && lastPoint.point.distanceSquared(point) < this.drawDistanceThreshold)
			return false;

		const brushPoint = new BrushPoint(point, lastPoint.color, lastPoint.brushSize, lastPoint.eraser);
		this.actionStack.push(new Action('brushPoint', brushPoint, pathId));
		brushPoint.drawLine(this.canvas, this.ctx, lastPoint);
		return true;
	}

	undo(): void {
		let pathId = -1;
		for (let i = this.actionStack.length - 1; i >= 0; i--)
		{
			if (pathId == -1 && !this.actionStack[i].undone) {
				pathId = this.actionStack[i].id;
				this.undos.push(pathId);
				this.actionStack[i].undone = true;
			} else if (pathId == this.actionStack[i].id) {
				this.actionStack[i].undone = true;
			}
		}
	}

	redo(): void {
		if (this.undos.length == 0)
			return;
		let pathId = -1;
		for (let i = 0; i < this.actionStack.length ; i++)
		{
			if (pathId == -1 && this.actionStack[i].undone) {
				pathId = this.actionStack[i].id;
				this.actionStack[i].undone = false;
			} else if (pathId == this.actionStack[i].id) {
				this.actionStack[i].undone = false;
			}
		}
		this.undos.pop();
	}

	render() {
		const lastPointPerGroup = new Map<number, number>();
		for (let i = 0; i < this.actionStack.length; i++) {
			if (lastPointPerGroup.get(this.actionStack[i].id) && !this.actionStack[i].undone)
				this.actionStack[i].data.drawLine(this.canvas, this.ctx, this.actionStack[lastPointPerGroup.get(this.actionStack[i].id)].data);
			lastPointPerGroup.set(this.actionStack[i].id, i);
		}
	}
}
