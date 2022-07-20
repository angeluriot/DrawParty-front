<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Global from "../shared/global";
	import Point from "../shared/Point";
	import DrawManager from "../shared/drawcanvas/DrawManager";
	import BrushPoint from "../shared/drawcanvas/BrushPoint";

	export let canDraw = true;
	export let clientOnly = false;

	// 0 = main (layer 2), 1 = layer 1, 2 = sketch
	let canvasByLayer: HTMLCanvasElement[] = [undefined, undefined, undefined];
	let contextByLayer: CanvasRenderingContext2D[] = [undefined, undefined, undefined];

	let selectedTool: string = 'brush';
	let drawing = false;
	let selectedColor = '#000000';
	let brushSize = 3;

	// 0 = main (layer 2), 1 = layer 1, 2 = sketch
	let selectedLayer = 0;

	let drawManager = new DrawManager();

	function selectBrush() {
		selectedTool = 'brush';
	}

	function selectEraser() {
		selectedTool = 'eraser';
	}

	function selectSketchLayer() {
		selectedLayer = 2;
	}

	function selectLayer1() {
		selectedLayer = 1;
	}

	function selectLayer2() {
		selectedLayer = 0;
	}

	function drawBackground() {
		// +1 because of the translation of the canvas for anti aliasing
		for (let i = 0; i < contextByLayer.length; i++)
			contextByLayer[i].clearRect(-1, -1, canvasByLayer[i].width + 1, canvasByLayer[i].height + 1);
	}

	onMount(() => {
		for (let i = 0; i < canvasByLayer.length; i++)
			contextByLayer[i] = canvasByLayer[i].getContext("2d");

		// Anti-aliasing
		for (let i = 0; i < contextByLayer.length; i++)
			contextByLayer[i].translate(0.5, 0.5);
		drawBackground();

		if (canDraw) {
			canvasByLayer[0].addEventListener('mousedown', onMouseDown);
			canvasByLayer[0].addEventListener('mousemove', onMouseMove);
			canvasByLayer[0].addEventListener('mouseup', stopDrawing);
		}

		if (!clientOnly) {
			// Triggered every server tick
			Global.socket.on('serverUpdate', (data: any) => {
				for (const action of data) {
					/*
					Since websockets preserve order, players' server-side actions and local actions are in the same order
					Therefore, the nth action of the server action list is the nth action of the local player.
					This allows to splice the first element of the local (unconfirmed) list every time we encounter an action of the local player
					*/

					if (action.type != 'undo' && action.type != 'redo' && action.type != 'updateBrush')
						drawManager.clearUndoStack(action.requestedBy);

					// Creates a new brush path
					if (action.type == 'createBrush') {
						if (action.requestedBy == Global.socket.id) {
							// Twice for the two points
							drawManager.confirmAction();
							drawManager.confirmAction();
							continue;
						}
						const brushPoint = new BrushPoint(new Point(action.data.point.x, action.data.point.y), action.data.color, action.data.size, action.data.eraser);
						drawManager.createBrush(action.requestedBy, brushPoint, action.data.layer, true, canvasByLayer[action.data.layer], contextByLayer[action.data.layer]);
						drawManager.moveLastToConfirmPosition();
						drawManager.moveLastToConfirmPosition();
					}
					// Adds a point to the current path of the action's player
					else if (action.type == 'updateBrush') {
						for (const point of action.data) {
							if (action.requestedBy == Global.socket.id) {
								drawManager.confirmAction();
								continue;
							}
							const lastAction = drawManager.getLastActionOfPlayer(action.requestedBy);
							drawManager.addPoint(lastAction, new Point(point.x, point.y), true, canvasByLayer[lastAction.layer], contextByLayer[lastAction.layer]);
							drawManager.moveLastToConfirmPosition();
						}
					}
					else if (action.type == 'undo') {
						if (action.requestedBy != Global.socket.id)
							drawManager.undo(action.requestedBy);
					}
					else if (action.type == 'redo') {
						if (action.requestedBy != Global.socket.id)
							drawManager.redo(action.requestedBy);
					}
				}
				if (data.length > 0)
					render();
			});

			// Clears all of a player's actions
			Global.socket.on('clearActions', (data: any) => {
				drawManager.clearActions(data.requestedBy);
			});
		}
	});

	function createBrush(point: Point): void {
		const brushPoint = new BrushPoint(point, selectedColor, brushSize, selectedTool == 'eraser');
		drawManager.createBrush(Global.socket.id, brushPoint, selectedLayer, selectedLayer == 2, canvasByLayer[selectedLayer], contextByLayer[selectedLayer]);
		if (selectedLayer != 2 && !clientOnly)
			Global.socket.emit('createBrush', { color: selectedColor, size: brushSize, point, eraser: selectedTool == 'eraser', layer: selectedLayer });
	}

	function addPoint(point: Point): boolean {
		const lastAction = drawManager.getLastActionOfPlayer(Global.socket.id);
		return drawManager.addPoint(lastAction, point, selectedLayer == 2, canvasByLayer[lastAction.layer], contextByLayer[lastAction.layer]);
	}

	onDestroy(() => {
		if (canDraw) {
			canvasByLayer[0].removeEventListener('mousedown', onMouseDown);
			canvasByLayer[0].removeEventListener('mousemove', onMouseMove);
			canvasByLayer[0].removeEventListener('mouseup', stopDrawing);
		}
		if (!clientOnly) {
			Global.socket.off('clearActions');
			Global.socket.off('serverUpdate');
		}
	})

	function onMouseDown(e: MouseEvent): void {
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvasByLayer[0].getBoundingClientRect());
		createBrush(point);
		drawing = true;
	}

	function onMouseMove(e: MouseEvent): void {
		if (!drawing)
			return;
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvasByLayer[0].getBoundingClientRect());
		if (addPoint(point) && selectedLayer != 2 && !clientOnly)
			Global.socket.emit('updateBrush', {points: [point]});
	}

	function stopDrawing(e: MouseEvent): void {
		drawing = false;
	}

	function clearButton(): void {
		drawManager.clearActions(Global.socket.id);
		render();
		if (!clientOnly)
			Global.socket.emit('clearActions');
	}

	function undoButton(): void {
		if (drawManager.undo(Global.socket.id) && !clientOnly)
			Global.socket.emit('undo');
		render();
	}

	function redoButton(): void {
		if (drawManager.redo(Global.socket.id) && !clientOnly) {
			Global.socket.emit('redo');
		}
		render();
	}

	function render() {
		drawBackground();

		const pathStartPerId = new Map<number, number>();
		let currentId = -1;
		for (let i = 0; i < drawManager.actions.length; i++) {
			if (drawManager.actions[i].undone)
				continue;

			if (currentId != drawManager.actions[i].id) {
				if (currentId != -1) {
					const index = pathStartPerId.get(currentId);
					drawManager.actions[index].data.render(contextByLayer[drawManager.actions[index].layer]);
				}
				currentId = drawManager.actions[i].id;
				pathStartPerId.set(currentId, i);
			}

			if (currentId == drawManager.actions[i].id) {
				const index = pathStartPerId.get(currentId);
				drawManager.actions[index].data.lineTo(canvasByLayer[drawManager.actions[index].layer], contextByLayer[drawManager.actions[index].layer], drawManager.actions[i].data.point);
			}
		}
		if (currentId != -1) {
			const index = pathStartPerId.get(currentId);
			drawManager.actions[index].data.render(contextByLayer[drawManager.actions[index].layer]);
		}
	}
</script>

<section>
	<div class="canvas-wrapper">
		<canvas class="sketch" bind:this={canvasByLayer[2]} width="800" height="600"></canvas>
		<canvas bind:this={canvasByLayer[1]} width="800" height="600"></canvas>
		<canvas bind:this={canvasByLayer[0]} width="800" height="600"></canvas>
	</div>

	{#if canDraw}
		<input type="color" bind:value={selectedColor}>
		<span>Brush size</span>
		<input type="range" min="1" max="30" bind:value={brushSize}>
		<button on:click={clearButton}>Clear</button>
		<button on:click={undoButton}>Undo</button>
		<button on:click={redoButton}>Redo</button>
		<button on:click={selectBrush}>Brush</button>
		<button on:click={selectEraser}>Eraser</button>
		<button on:click={selectSketchLayer}>Sketch</button>
		<button on:click={selectLayer1}>Layer 1</button>
		<button on:click={selectLayer2}>Layer 2</button>
	{/if}
</section>

<style>
	div.canvas-wrapper {
		position: relative;
		background-color: white;
		width: 800px;
		height: 600px;
		margin: auto;
	}

	canvas {
		position: absolute;
		top: 0%;
		left: 0%;
	}

	canvas.sketch {
		opacity: 0.5;
	}

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
