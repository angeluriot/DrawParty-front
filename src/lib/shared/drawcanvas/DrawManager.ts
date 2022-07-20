import Global from "../global";
import type Point from "../Point";
import Action from "./Action";
import BrushPoint from "./BrushPoint";

export default class DrawManager {
	readonly drawDistanceThreshold = 0.000006;

	undosPerPlayer = new Map<string, number[]>();
	actions: Action[] = [];
	actionsNotSent: any[] = [];
	totalActions = 0;

	createBrush(playerId: string, brushPoint: BrushPoint, layer: number, confirmed: boolean, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, sendToServer: boolean): void {
		this.clearUndoStack(playerId);
		this.actions.push(new Action('brushPoint', brushPoint, this.totalActions, layer, confirmed, playerId));
		this.actions.push(new Action('brushPoint', brushPoint, this.totalActions++, layer, confirmed, playerId));
		brushPoint.drawLine(canvas, ctx, brushPoint);
		if (sendToServer) {
			this.actionsNotSent.push({
				type: 'createBrush',
				layer,
				color: brushPoint.color,
				size: brushPoint.brushSize,
				eraser: brushPoint.eraser,
				point: {
					x: brushPoint.point.x,
					y: brushPoint.point.y
				}
			});
		}
	}

	getLastActionOfPlayer(playerId: string): Action {
		for (let i = this.actions.length - 1; i >= 0; i--) {
			if (this.actions[i].player == playerId)
				return this.actions[i];
		}
		return null;
	}

	addPoint(lastAction: Action, point: Point, confirmed: boolean, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, sendToServer: boolean): boolean {
		if (lastAction && point.distanceSquared(lastAction.data.point) < this.drawDistanceThreshold)
			return false;

		const brushPoint = new BrushPoint(point, lastAction.data.color, lastAction.data.brushSize, lastAction.data.eraser);
		this.actions.push(new Action('brushPoint', brushPoint, lastAction.id, lastAction.layer, confirmed, lastAction.player));
		brushPoint.drawLine(canvas, ctx, lastAction.data);
		if (sendToServer)
			this.actionsNotSent.push({type: 'updateBrush', point});
		return true;
	}

	confirmAction() {
		let index = this.actions.findIndex(a => !a.confirmed);
		if (index == -1)
			return;
		this.actions[index].confirmed = true;
	}

	addLastToNotSent() {
		this.actionsNotSent.push(this.actions[this.actions.length - 1]);
	}

	moveLastToConfirmPosition() {
		let index = 0;
		while (index < this.actions.length && this.actions[index].confirmed)
			index++;
		if (index < this.actions.length)
			Global.arrayMove(this.actions, this.actions.length - 1, index);
	}

	undo(playerId: string, sendToServer: boolean): void {
		if (!this.undosPerPlayer.get(playerId))
			this.undosPerPlayer.set(playerId, []);
		let pathId = -1;
		let layer = -1;
		for (let i = this.actions.length - 1; i >= 0; i--)
		{
			if (pathId == -1 && this.actions[i].player == playerId && !this.actions[i].undone) {
				pathId = this.actions[i].id;
				layer = this.actions[i].layer;
				this.undosPerPlayer.get(playerId).push(pathId);
				this.actions[i].undone = true;
			} else if (pathId == this.actions[i].id)
				this.actions[i].undone = true;
		}
		if (sendToServer && layer != 2)
			this.actionsNotSent.push({type: 'undo'});
	}

	redo(playerId: string, sendToServer: boolean): boolean {
		if (!this.undosPerPlayer.get(playerId))
			return false;
		let pathId = -1;
		let layer = -1;
		for (let i = 0; i < this.actions.length ; i++)
		{
			if (pathId == -1 && this.actions[i].player == playerId && this.actions[i].undone) {
				pathId = this.actions[i].id;
				layer = this.actions[i].layer;
				this.actions[i].undone = false;
			} else if (pathId == this.actions[i].id)
				this.actions[i].undone = false;
		}
		this.undosPerPlayer.get(playerId).pop();
		if (!this.undosPerPlayer.get(playerId))
			this.undosPerPlayer.delete(playerId);
		if (sendToServer && layer != 2)
			this.actionsNotSent.push({type: 'redo'});
	}

	clearUndoStack(playerId: string) {
		if (!this.undosPerPlayer.get(playerId))
			return;
		const pathIds = this.undosPerPlayer.get(playerId);
		for (let i = 0; i < this.actions.length; i++)
			if (pathIds.indexOf(this.actions[i].id) != -1)
				this.actions.splice(i--, 1);
		this.undosPerPlayer.delete(playerId);
	}

	clearActions(playerId: string, sendToServer: boolean) {
		for (let i = 0; i < this.actions.length; i++)
			if (this.actions[i].player == playerId)
				this.actions.splice(i--, 1);
		if (this.undosPerPlayer.get(playerId))
			this.undosPerPlayer.delete(playerId);
		if (sendToServer)
			this.actionsNotSent.push({type: 'clear'});
	}
}
