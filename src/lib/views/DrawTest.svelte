<script lang="ts">
	import { onMount, onDestroy } from "svelte";
import BrushPoint from "../shared/BrushLine";
	import Global from "../shared/global";
	import Point from "../shared/Point";

	const drawDistanceThreshold = 4

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	let totalActions = 0;
	let drawing = false;
	const actionsPerPlayer = new Map<string, number[]>();
	const pointStack: BrushPoint[] = [];

	const redoPerPlayer = new Map<string, number[]>();
	const redoStack: BrushPoint[] = [];

	let selectedColor = '#000000';
	let brushSize = 3;

	function drawBackground() {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	onMount(() => {
		ctx = canvas.getContext("2d");

		// Anti-aliasing
		ctx.translate(0.5, 0.5);

		drawBackground();

		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('mouseleave', stopDrawing);
		canvas.addEventListener('mouseup', stopDrawing);

		Global.socket.on('createBrush', (data: any) => {
			createBrush(data.requestedBy, data.action.point, data.action.color, data.action.size, ctx);
		});

		Global.socket.on('updateBrush', (data: any) => {
			if (!actionsPerPlayer.get(data.requestedBy))
				return;
			for (const point of data.points)
				addPoint(data.requestedBy, point);
		});

		Global.socket.on('undo', (data: any) => {
			if (!actionsPerPlayer.get(data.requestedBy))
				return;
			undo(data.requestedBy);
		});

		Global.socket.on('redo', (data: any) => {
			if (!actionsPerPlayer.get(data.requestedBy))
			return;
			redo(data.requestedBy);
		});

		// Adds a point to the player's current action. It's called every 10 points placed on the client side
		Global.socket.on('clearActions', (data: any) => {
			clearActions(data.requestedBy);
		});
	});

	function createBrush(playerId: string, point: Point, selectedColor: string, brushSize: number, ctx: CanvasRenderingContext2D): void {
		if (!actionsPerPlayer.get(playerId))
			actionsPerPlayer.set(playerId, []);
		actionsPerPlayer.get(playerId).push(totalActions);
		const brushPoint = new BrushPoint(totalActions++, new Point(point.x, point.y), selectedColor, brushSize);
		pointStack.push(brushPoint);
		pointStack.push(brushPoint);
		brushPoint.drawLine(ctx, brushPoint);
	}

	function addPoint(playerId: string, point: Point): boolean {
		if (!actionsPerPlayer.get(playerId))
			return false;
		const currentAction = actionsPerPlayer.get(playerId).length - 1;
		const pathId = actionsPerPlayer.get(playerId)[currentAction];
		let lastPoint: BrushPoint = undefined;
		// findLast and findLastIndex are not compatible with firefox
		for (let i = pointStack.length - 2; i >= 0; i--) {
			if (pathId == pointStack[i].pathId) {
				lastPoint = pointStack[i];
				break;
			}
		}
		if (lastPoint && lastPoint.point.distanceSquared(point) < drawDistanceThreshold)
			return false;

		const brushPoint = new BrushPoint(pathId, new Point(point.x, point.y), lastPoint.color, lastPoint.brushSize);
		pointStack.push(brushPoint);
		brushPoint.drawLine(ctx, lastPoint);
		return true;
	}

	onDestroy(() => {
		canvas.removeEventListener('mousedown', onMouseDown)
	})

	function onMouseDown(e: MouseEvent): void {
		if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)
			return;
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvas.getBoundingClientRect());
		createBrush(Global.socket.id, point, selectedColor, brushSize, ctx);
		Global.socket.emit('createBrush', { color: selectedColor, size: brushSize, point });
		drawing = true;
	}

	function onMouseMove(e: MouseEvent): void {
		if (!drawing)
			return;
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvas.getBoundingClientRect());
		if (addPoint(Global.socket.id, point))
			Global.socket.emit('updateBrush', {points: [point]});
	}

	function stopDrawing(e: MouseEvent): void {
		drawing = false;
	}

	function clearButton(): void {
		clearActions(Global.socket.id);
		Global.socket.emit('clearActions');
	}

	function clearActions(playerId: string): void {
		if (!actionsPerPlayer.get(playerId))
			return;
		for (let i = 0; i < pointStack.length; i++) {
			if (actionsPerPlayer.get(playerId).indexOf(pointStack[i].pathId) != -1) {
				pointStack.splice(i--, 1);
			}
		}
		actionsPerPlayer.delete(playerId);
		render();
	}

	function undo(playerId: string): void {
		if (!actionsPerPlayer.get(playerId))
			return;
		const idToUndo = actionsPerPlayer.get(playerId).pop();
		for (let i = 0; i < pointStack.length - 1; i++) {
			if (pointStack[i].pathId == idToUndo) {
				const removed = pointStack.splice(i--, 1);
				redoStack.push(...removed);
			}
		}
		if (!redoPerPlayer.get(playerId))
			redoPerPlayer.set(playerId, []);
		redoPerPlayer.get(playerId).push(idToUndo);
		render();
	}

	function redo(playerId: string): void {
		if (!redoPerPlayer.get(playerId))
			return;
		const idToRedo = redoPerPlayer.get(playerId).pop();
		for (let i = 0; i < redoStack.length - 1; i++) {
			if (redoStack[i].pathId == idToRedo) {
				const removed = redoStack.splice(i--, 1);
				pointStack.push(...removed);
			}
		}
		render();
	}

	function undoButton(): void {
		undo(Global.socket.id);
		Global.socket.emit('undo');
	}

	function redoButton(): void {
		redo(Global.socket.id);
		Global.socket.emit('redo');
	}

	function render() {
		drawBackground();
		const lastPointPerGroup = new Map<number, number>();
		for (let i = 0; i < pointStack.length; i++) {
			if (lastPointPerGroup.get(pointStack[i].pathId)) {
				pointStack[i].drawLine(ctx, pointStack[lastPointPerGroup.get(pointStack[i].pathId)]);
			}
			lastPointPerGroup.set(pointStack[i].pathId, i);
		}
	}
</script>

<section>
	<canvas bind:this={canvas} width="800" height="600"></canvas>
	<input type="color" bind:value={selectedColor}>
	<span>Brush size : {brushSize}</span>
	<input type="range" min="1" max="30" bind:value={brushSize}>
	<button on:click={clearButton}>Clear</button>
	<button on:click={undoButton}>Undo</button>
	<button on:click={redoButton}>Redo</button>
</section>

<style>
	section {
		background-color: #ca0000ff;
	}

	input[type="color"] {
		background-color: transparent;
		border: none;
		padding: 0;
		width: 50px;
		height: 50px;
	}
</style>
