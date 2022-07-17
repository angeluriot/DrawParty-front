import Point from "../Point";
import Action from "./Action";
import BrushPoint from "./BrushPoint";

export default class ServerDraw {

	// Same as totalActions but increments only for confirmed actions, of any player
	totalActions = 0;

	/*
	List of action group ids per player, it is used to keep track of which path is owned by a player, etc.
	Therefore allowing to do things on an action group based on a player id
	*/
	actionsPerPlayer = new Map<string, number[]>();

	// Same as localPointStack but for confirmed actions
	actionStack: Action[] = [];
	undosPerPlayer = new Map<string, number[]>();

	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
		this.ctx = ctx;
		this.canvas = canvas;
	}

	clearUndoStackOfPlayer(playerId: string): void {
		const ids = this.undosPerPlayer.get(playerId);
		for (let i = 0; i < this.actionStack.length; i++)
			if (ids.indexOf(this.actionStack[i].id) != -1)
				this.actionStack.splice(i, 1);
		this.undosPerPlayer.delete(playerId);
	}

	createBrush(action: any) {
		if (!this.actionsPerPlayer.get(action.requestedBy))
			this.actionsPerPlayer.set(action.requestedBy, [])
		this.actionsPerPlayer.get(action.requestedBy).push(this.totalActions);
		const brushPoint = new BrushPoint(new Point(action.data.point.x, action.data.point.y), action.data.color, action.data.size, action.data.eraser);
		const savedAction = new Action('brushPoint', brushPoint, this.totalActions++, action.data.layer);
		// Twice because we need two points to make a point if the player clicks without moving
		this.actionStack.push(savedAction);
		this.actionStack.push(savedAction);
	}

	updateBrush(action: any) {
		if (!this.actionsPerPlayer.get(action.requestedBy))
			return;
		for (const point of action.data) {
			// We use the last point to determine the size and the color of the brush
			const lastAction = this.actionsPerPlayer.get(action.requestedBy)[this.actionsPerPlayer.get(action.requestedBy).length - 1];
			let lastPoint: BrushPoint = undefined;
			let lastLayer: number = undefined;
			// findLast and findLastIndex are not compatible with firefox
			for (let i = this.actionStack.length - 1; i >= 0; i--) {
				if (lastAction == this.actionStack[i].id) {
					lastPoint = this.actionStack[i].data;
					lastLayer = this.actionStack[i].layer;
					break;
				}
			}
			const brushPoint = new BrushPoint(new Point(point.x, point.y), lastPoint.color, lastPoint.brushSize, lastPoint.eraser);
			this.actionStack.push(new Action('brushPoint', brushPoint, lastAction, lastLayer));
		}
	}

	undo(playerId: string) {
		if (!this.actionsPerPlayer.get(playerId))
			return;
		let pathId = -1;
		for (let i = this.actionStack.length - 1; i >= 0; i--)
		{
			if (pathId == -1 && this.actionsPerPlayer.get(playerId).indexOf(this.actionStack[i].id) != -1 && !this.actionStack[i].undone) {
				if (!this.undosPerPlayer.get(playerId))
					this.undosPerPlayer.set(playerId, []);
				pathId = this.actionStack[i].id;
				this.undosPerPlayer.get(playerId).push(pathId);
				this.actionStack[i].undone = true;
			} else if (pathId == this.actionStack[i].id) {
				this.actionStack[i].undone = true;
			}
		}
	}

	redo(playerId: string) {
		if (!this.actionsPerPlayer.get(playerId) || !this.undosPerPlayer.get(playerId))
			return;
		let pathId = -1;
		const ids = this.undosPerPlayer.get(playerId);
		for (let i = 0; i < this.actionStack.length - 1; i++)
		{
			if (pathId == -1 && ids.indexOf(this.actionStack[i].id) != -1) {
				pathId = this.actionStack[i].id;
				this.actionStack[i].undone = false;
			} else if (pathId == this.actionStack[i].id) {
				this.actionStack[i].undone = false;
			}
		}
		if (ids.length == 1)
			this.undosPerPlayer.delete(playerId);
		else
			this.undosPerPlayer.get(playerId).pop();
	}
}
