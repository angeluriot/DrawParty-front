<script lang="ts">
	import { onMount, onDestroy } from "svelte";
import BrushPoint from "../shared/BrushLine";
	import Global from "../shared/global";
	import Point from "../shared/Point";

	const drawDistanceThreshold = 4

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	// Local
	let totalActions = 0;
	let drawing = false;
	let selectedColor = '#000000';
	let brushSize = 3;
	const localPointStack: BrushPoint[] = [];

	// Server
	let serverTotalActions = 0;
	const serverActionsPerPlayer = new Map<string, number[]>();
	const serverActions: BrushPoint[] = [];

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

		Global.socket.on('serverUpdate', (data: any) => {
			for (const action of data) {
				if (action.requestedBy == Global.socket.id)
					localPointStack.splice(0, 1);

				if (action.type == 'createBrush') {
					if (!serverActionsPerPlayer.get(action.requestedBy))
						serverActionsPerPlayer.set(action.requestedBy, [])
					serverActionsPerPlayer.get(action.requestedBy).push(serverTotalActions);
					const brushPoint = new BrushPoint(serverTotalActions++, new Point(action.data.point.x, action.data.point.y), action.data.color, action.data.size);
					serverActions.push(brushPoint);
					serverActions.push(brushPoint);
				}
				else if (action.type == 'updateBrush') {
					if (!serverActionsPerPlayer.get(action.requestedBy))
						continue
					for (const point of action.data) {
						const lastAction = serverActionsPerPlayer.get(action.requestedBy)[serverActionsPerPlayer.get(action.requestedBy).length - 1];
						let lastPoint: BrushPoint = undefined;
						// findLast and findLastIndex are not compatible with firefox
						for (let i = serverActions.length - 2; i >= 0; i--) {
							if (lastAction == serverActions[i].pathId) {
								lastPoint = serverActions[i];
								break;
							}
						}
						const brushPoint = new BrushPoint(lastAction, new Point(point.x, point.y), lastPoint.color, lastPoint.brushSize);
						serverActions.push(brushPoint);
					}
				}
			}
			if (data.length > 0)
				render();
		});

		// Adds a point to the player's current action. It's called every 10 points placed on the client side
		Global.socket.on('clearActions', (data: any) => {
			clearActions(data.requestedBy);
		});
	});

	function createBrush(playerId: string, point: Point, selectedColor: string, brushSize: number, ctx: CanvasRenderingContext2D): void {
		const brushPoint = new BrushPoint(totalActions++, new Point(point.x, point.y), selectedColor, brushSize);
		localPointStack.push(brushPoint);
		localPointStack.push(brushPoint);
		brushPoint.drawLine(ctx, brushPoint);
	}

	function addPoint(playerId: string, point: Point): boolean {
		let lastPoint: BrushPoint = undefined;
		if (localPointStack.length > 0)
			lastPoint = localPointStack[localPointStack.length - 1];
		else {
			const lastPathId = serverActionsPerPlayer.get(Global.socket.id)[serverActionsPerPlayer.get(Global.socket.id).length - 1];
			// findLast and findLastIndex are not compatible with firefox
			for (let i = serverActions.length - 2; i >= 0; i--) {
				if (lastPathId == serverActions[i].pathId) {
					lastPoint = serverActions[i];
					break;
				}
			}
		}
		const pathId = lastPoint.pathId;
		if (lastPoint && lastPoint.point.distanceSquared(point) < drawDistanceThreshold)
			return false;

		const brushPoint = new BrushPoint(pathId, new Point(point.x, point.y), lastPoint.color, lastPoint.brushSize);
		localPointStack.push(brushPoint);
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
		if (playerId == Global.socket.id)
			localPointStack.length = 0;
		if (!serverActionsPerPlayer.get(playerId))
			return;
		const pathIds = serverActionsPerPlayer.get(playerId);
		for (let i = 0; i < serverActions.length - 1; i++) {
			if (pathIds.indexOf(serverActions[i].pathId) != -1)
				serverActions.splice(i--, 1);
		}
	}

	function undo(playerId: string): void {
	}

	function redo(playerId: string): void {
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

		// Render server actions
		const serverLastPointPerGroup = new Map<number, number>();
		for (let i = 0; i < serverActions.length; i++) {
			if (serverLastPointPerGroup.get(serverActions[i].pathId))
				serverActions[i].drawLine(ctx, serverActions[serverLastPointPerGroup.get(serverActions[i].pathId)]);
			serverLastPointPerGroup.set(serverActions[i].pathId, i);
		}

		// Render client local actions that server hasn't saved yet
		const lastPointPerGroup = new Map<number, number>();
		for (let i = 0; i < localPointStack.length; i++) {
			if (lastPointPerGroup.get(localPointStack[i].pathId))
				localPointStack[i].drawLine(ctx, localPointStack[lastPointPerGroup.get(localPointStack[i].pathId)]);
			lastPointPerGroup.set(localPointStack[i].pathId, i);
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
