<script lang="ts">`
	/*
	The algorithm works with two separate lists,
	one representing the actions confirmed by the server and
	one representing local changes that aren't confirmed yet.
	Local actions are drawn over server ones.

	An action is confirmed when it appears in a 'serverUpdate' socket.io event.

	An action is currently just a point with an id representing the path to which the point belongs.

	The server can send different actions during the 'serverUpdate' event :
	- createBrush, creates the first points of a new path
	- updateBrush, add points to the current path of the action's player

	The clear action is handled in its own socket.io event 'clearActions'
	*/
`
	import { onMount, onDestroy } from "svelte";
	import type BrushPoint from "../shared/drawcanvas/BrushPoint";
	import Global from "../shared/global";
	import Point from "../shared/Point";
	import LocalDraw from "../shared/drawcanvas/LocalDraw";
	import ServerDraw from "../shared/drawcanvas/ServerDraw";

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	let selectedTool: string = 'brush';
	let drawing = false;
	let selectedColor = '#000000';
	let brushSize = 3;

	let localDraw: LocalDraw;
	let serverDraw: ServerDraw;

	function selectBrush() {
		selectedTool = 'brush';
	}

	function selectEraser() {
		selectedTool = 'eraser';
	}

	function drawBackground() {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	onMount(() => {
		ctx = canvas.getContext("2d");
		localDraw = new LocalDraw(canvas, ctx);
		serverDraw = new ServerDraw(canvas, ctx);

		// Anti-aliasing
		ctx.translate(0.5, 0.5);
		drawBackground();

		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('mouseup', stopDrawing);

		// Triggered every server tick
		Global.socket.on('serverUpdate', (data: any) => {
			for (const action of data) {
				/*
				Since websockets preserve order, players' server-side actions and local actions are in the same order
				Therefore, the nth action of the server action list is the nth action of the local player.
				This allows to splice the first element of the local (unconfirmed) list every time we encounter an action of the local player
				*/
				if (action.requestedBy == Global.socket.id)
					localDraw.actionStack.splice(0, 1);

				if (action.type != 'undo' && action.type != 'redo' && action.type != 'updateBrush' && serverDraw.undosPerPlayer.get(action.requestedBy))
					serverDraw.clearUndoStackOfPlayer(action.requestedBy);

				// Creates a new brush path
				if (action.type == 'createBrush')
					serverDraw.createBrush(action);
				// Adds a point to the current path of the action's player
				else if (action.type == 'updateBrush')
					serverDraw.updateBrush(action)
				else if (action.type == 'undo')
					serverDraw.undo(action.requestedBy);
				else if (action.type == 'redo')
					serverDraw.redo(action.requestedBy);
			}
			if (data.length > 0)
				render();
		});

		// Clears all of a player's actions
		Global.socket.on('clearActions', (data: any) => {
			clearActions(data.requestedBy);
		});
	});

	function clearUndoStack() {
		for (let i = 0; i < serverDraw.actionStack.length; i++)
			if (localDraw.undos.indexOf(serverDraw.actionStack[i].id) != -1)
				serverDraw.actionStack.splice(i, 1);
		localDraw.undos.length = 0;
	}

	function createBrush(point: Point, selectedColor: string, brushSize: number, eraser: boolean): void {
		clearUndoStack();
		localDraw.createBrush(point, selectedColor, brushSize, eraser);
	}

	function addPoint(point: Point): boolean {
		let lastPoint: BrushPoint = undefined;
		let pathId = 0;
		if (localDraw.actionStack.length > 0) {
			lastPoint = localDraw.actionStack[localDraw.actionStack.length - 1].data;
			pathId = localDraw.actionStack[localDraw.actionStack.length - 1].id;
		} else {
			pathId = serverDraw.actionsPerPlayer.get(Global.socket.id)[serverDraw.actionsPerPlayer.get(Global.socket.id).length - 1];
			// findLast and findLastIndex are not compatible with firefox
			for (let i = serverDraw.actionStack.length - 1; i >= 0; i--) {
				if (pathId == serverDraw.actionStack[i].id) {
					lastPoint = serverDraw.actionStack[i].data;
					break;
				}
			}
		}
		return localDraw.addPoint(point, lastPoint, pathId);
	}

	onDestroy(() => {
		canvas.removeEventListener('mousedown', onMouseDown);
		canvas.removeEventListener('mousemove', onMouseMove);
		canvas.removeEventListener('mouseup', stopDrawing);
	})

	function onMouseDown(e: MouseEvent): void {
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvas.getBoundingClientRect());
		createBrush(point, selectedColor, brushSize, selectedTool == 'eraser');
		Global.socket.emit('createBrush', { color: selectedColor, size: brushSize, point, eraser: selectedTool == 'eraser' });
		drawing = true;
	}

	function onMouseMove(e: MouseEvent): void {
		if (!drawing)
			return;
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvas.getBoundingClientRect());
		if (addPoint(point))
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
		{
			localDraw.actionStack.length = 0;
			localDraw.undos.length = 0;
		}
		if (!serverDraw.actionsPerPlayer.get(playerId)) {
			render();
			return;
		}
		const pathIds = serverDraw.actionsPerPlayer.get(playerId);
		for (let i = 0; i < serverDraw.actionStack.length - 1; i++) {
			if (pathIds.indexOf(serverDraw.actionStack[i].id) != -1)
				serverDraw.actionStack.splice(i--, 1);
		}
		render();
	}

	function undoButton(): void {
		localDraw.undo();
		render();
		Global.socket.emit('undo');
	}

	function redoButton(): void {
		localDraw.redo();
		render();
		Global.socket.emit('redo');
	}

	function render() {
		drawBackground();
		serverDraw.render();
		localDraw.render();
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
	<button on:click={selectBrush}>Brush</button>
	<button on:click={selectEraser}>Eraser</button>
</section>

<style>
	canvas {
		background-color: white;
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
