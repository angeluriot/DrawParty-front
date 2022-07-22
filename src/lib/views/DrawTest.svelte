<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Global from "../shared/global";
	import Point from "../shared/Point";
	import DrawManager from "../shared/drawcanvas/DrawManager";
	import BrushPoint from "../shared/drawcanvas/BrushPoint";
	import Fill from "../shared/drawcanvas/Fill";

	export let canDraw = Math.random() < 0.5;
	export let clientOnly = false;
	export let multipleDrawers = false;

	// 0 = main (layer 2), 1 = layer 1, 2 = sketch
	let canvasByLayer: HTMLCanvasElement[] = [undefined, undefined, undefined];
	let contextByLayer: CanvasRenderingContext2D[] = [undefined, undefined, undefined];

	let selectedTool: string = 'brush';
	let drawing = false;
	let selectedColor = '#000000';
	let brushSize = 3;
	let updateIntervalId: NodeJS.Timer;

	// Only used in single drawer and not client only mode
	let actionsRendered = 0;

	// 0 = main (layer 2), 1 = layer 1, 2 = sketch
	let selectedLayer = 0;

	let drawManager = new DrawManager();

	function selectFill() {
		selectedTool = 'fill';
	}

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

	function sendActionsToServer() {
		if (drawManager.actionsNotSent.length > 0) {
			Global.socket.emit('clientUpdate', drawManager.actionsNotSent);
			drawManager.actionsNotSent.length = 0;
		}
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
			updateIntervalId = setInterval(sendActionsToServer, 1 / 20 * 1000);

			// Triggered every server tick
			Global.socket.on('serverUpdate', (data: any) => {
				let needToRedraw = false;

				for (const action of data) {
					if (action.type != 'undo' && action.type != 'redo' && action.type != 'updateBrush') {
						let diff = drawManager.actions.length;
						drawManager.clearUndoStack(action.requestedBy);
						diff -= drawManager.actions.length;
						actionsRendered -= diff;
					}

					if (action.type == 'createBrush') {
						if (action.requestedBy == Global.socket.id) {
							// Twice for the two points
							drawManager.confirmAction();
							drawManager.confirmAction();
							continue;
						}
						const brushPoint = new BrushPoint(new Point(action.data.point.x, action.data.point.y), action.data.color, action.data.size, action.data.eraser);
						drawManager.createBrush(action.requestedBy, brushPoint, action.data.layer, true, canvasByLayer[action.data.layer], contextByLayer[action.data.layer], false);
						drawManager.moveLastToConfirmPosition();
						drawManager.moveLastToConfirmPosition();
					}
					// Adds a point to the current path of the action's player
					else if (action.type == 'updateBrush') {
						if (action.requestedBy == Global.socket.id) {
							drawManager.confirmAction();
							continue;
						}
						const point = new Point(action.data.x, action.data.y);
						const lastAction = drawManager.getLastActionOfPlayer(action.requestedBy);
						drawManager.addPoint(lastAction, point, true, canvasByLayer[lastAction.layer], contextByLayer[lastAction.layer], false);
						drawManager.moveLastToConfirmPosition();
					}
					else if (action.type == 'undo') {
						if (action.requestedBy != Global.socket.id) {
							drawManager.undo(action.requestedBy, false);
							needToRedraw = true;
						}
					}
					else if (action.type == 'redo') {
						if (action.requestedBy != Global.socket.id) {
							drawManager.redo(action.requestedBy, false);
							needToRedraw = true;
						}
					}
					else if (action.type == 'clear') {
						if (action.requestedBy != Global.socket.id) {
							drawManager.clearActions(action.requestedBy, false);
							needToRedraw = true;
						}
					}
					else if (action.type == 'fill') {
						if (action.requestedBy == Global.socket.id) {
							drawManager.confirmAction();
							continue;
						}
						const brushPoint = new Fill(new Point(action.data.point.x, action.data.point.y), action.data.color);
						drawManager.createFill(action.requestedBy, brushPoint, action.data.layer, true, canvasByLayer[action.data.layer], contextByLayer[action.data.layer], false);
						drawManager.moveLastToConfirmPosition();
					}
				}
				if (needToRedraw || (data.length > 0 && multipleDrawers))
					renderFull();
				else if (data.length > 0 && !canDraw)
					render();
			});
		}
	});

	function createBrush(point: Point): void {
		const brushPoint = new BrushPoint(point, selectedColor, brushSize, selectedTool == 'eraser');
		drawManager.createBrush(Global.socket.id, brushPoint, selectedLayer, selectedLayer == 2, canvasByLayer[selectedLayer], contextByLayer[selectedLayer], selectedLayer != 2 && !clientOnly);
	}

	function addPoint(point: Point): boolean {
		const lastAction = drawManager.getLastActionOfPlayer(Global.socket.id);
		return drawManager.addPoint(lastAction, point, selectedLayer == 2, canvasByLayer[lastAction.layer], contextByLayer[lastAction.layer], selectedLayer != 2 && !clientOnly);
	}

	onDestroy(() => {
		if (canDraw) {
			canvasByLayer[0].removeEventListener('mousedown', onMouseDown);
			canvasByLayer[0].removeEventListener('mousemove', onMouseMove);
			canvasByLayer[0].removeEventListener('mouseup', stopDrawing);
		}
		if (!clientOnly) {
			clearInterval(updateIntervalId);
			Global.socket.off('serverUpdate');
		}
	})

	function createFill(point: Point) {
		const fill = new Fill(point, selectedColor);
		drawManager.createFill(Global.socket.id, fill, selectedLayer, selectedLayer == 2, canvasByLayer[selectedLayer], contextByLayer[selectedLayer], selectedLayer != 2 && !clientOnly);
	}

	function onMouseDown(e: MouseEvent): void {
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvasByLayer[0].getBoundingClientRect());
		if (selectedTool == 'brush' || selectedTool == 'eraser')
			createBrush(point);
		else if (selectedTool == 'fill')
			createFill(point);
		drawing = true;
	}

	function onMouseMove(e: MouseEvent): void {
		if (!drawing)
			return;
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvasByLayer[0].getBoundingClientRect());
		addPoint(point)
	}

	function stopDrawing(e: MouseEvent): void {
		drawing = false;
	}

	function clearButton(): void {
		drawManager.clearActions(Global.socket.id, !clientOnly);
		renderFull();
	}

	function undoButton(): void {
		drawManager.undo(Global.socket.id, !clientOnly)
		renderFull();
	}

	function redoButton(): void {
		drawManager.redo(Global.socket.id, !clientOnly)
		renderFull();
	}

	function renderFrom(start: number) {
		const pathStartPerId = new Map<number, number>();
		let currentId = -1;

		for (let i = start; i < drawManager.actions.length; i++) {
			if (drawManager.actions[i].undone)
				continue;

			if (currentId != drawManager.actions[i].id && currentId != -1) {
				const index = pathStartPerId.get(currentId);
				drawManager.actions[index].data.render(contextByLayer[drawManager.actions[index].layer]);
			}

			if (drawManager.actions[i].type == 'brushPoint') {
				if (currentId != drawManager.actions[i].id) {
					const pathStartIndex = (start > 0 && drawManager.actions[start - 1].id == drawManager.actions[i].id) ? start - 1 : i;
					currentId = drawManager.actions[pathStartIndex].id;
					pathStartPerId.set(currentId, pathStartIndex);
				} else {
					const index = pathStartPerId.get(currentId);
					drawManager.actions[index].data.lineTo(canvasByLayer[drawManager.actions[index].layer], contextByLayer[drawManager.actions[index].layer], drawManager.actions[i].data.point);
				}
			}
			else if (drawManager.actions[i].type == 'fill') {
				drawManager.actions[i].data.render(canvasByLayer[drawManager.actions[i].layer], contextByLayer[drawManager.actions[i].layer]);
			}
		}

		if (currentId != -1) {
			const index = pathStartPerId.get(currentId);
			drawManager.actions[index].data.render(contextByLayer[drawManager.actions[index].layer]);
		}
	}

	function renderFull() {
		drawBackground();
		renderFrom(0);
		actionsRendered = drawManager.actions.length;
	}

	function render() {
		renderFrom(actionsRendered);
		actionsRendered = drawManager.actions.length;
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
		{#if !multipleDrawers}
			<button on:click={selectFill}>Fill</button>
		{/if}
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
