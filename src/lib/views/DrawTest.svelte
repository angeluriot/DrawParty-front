<script lang="ts">
	import { onMount, onDestroy } from "svelte";
import BrushPoint from "../shared/BrushLine";
	import { DrawAction, BrushAction } from "../shared/DrawAction";
	import Global from "../shared/global";
	import Point from "../shared/Point";

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	let totalActions = 0;
	let drawing = false;
	const actionsPerPlayer = new Map<string, number[]>();
	const pointStack: BrushPoint[] = [];

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

		// Adds a point to the player's current action. It's called every 10 points placed on the client side
		Global.socket.on('clearActions', (data: any) => {
			clearActions(data.requestedBy);
		});
	});

	function createBrush(playerId: string, point: Point, selectedColor: string, brushSize: number, ctx: CanvasRenderingContext2D): void {
		if (!actionsPerPlayer.get(playerId))
			actionsPerPlayer.set(playerId, []);
		actionsPerPlayer.get(playerId).push(totalActions);
		const brushPoint = new BrushPoint(totalActions++, point, selectedColor, brushSize);
		pointStack.push(brushPoint);
		pointStack.push(brushPoint);
		brushPoint.drawLine(ctx, brushPoint);
	}

	function addPoint(playerId: string, point: Point): void {
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

		const brushPoint = new BrushPoint(pathId, point, lastPoint.color, lastPoint.brushSize);
		pointStack.push(brushPoint);
		brushPoint.drawLine(ctx, lastPoint);
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
		addPoint(Global.socket.id, point);
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
