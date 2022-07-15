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
	import BrushPoint from "../shared/BrushLine";
	import Global from "../shared/global";
	import Point from "../shared/Point";

	/*
	The minimum distance in pixels^2 between two points of a path
	it is used to prevent small paths from having too many points
	*/
	const drawDistanceThreshold = 4

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	// Local

	/*
	The current amount of local actions (creating a path, filling, ...).
	It is used to create group ids for actions, in the case an action is dependant of an other
	(like updatePath that adds a point to an already existing action)
	When undoing, all the actions with a certain id are deleted. This is how we remove all points of a path
	*/
	let totalActions = 0;
	let drawing = false;
	let selectedColor = '#000000';
	let brushSize = 3;
	// This is the list of all current points that hasn't been confirmed by the server yet
	const localPointStack: BrushPoint[] = [];

	// Server

	// Same as totalActions but increments only for confirmed actions, of any player
	let serverTotalActions = 0;
	/*
	List of action group ids per player, it is used to keep track of which path is owned by a player, etc.
	Therefore allowing to do things on an action group based on a player id
	*/
	const serverActionsPerPlayer = new Map<string, number[]>();
	// Same as localPointStack but for confirmed actions
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

		document.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mouseenter', onMouseEnter);
		canvas.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', stopDrawing);

		// Triggered every server tick
		Global.socket.on('serverUpdate', (data: any) => {
			for (const action of data) {
				/*
				Since websockets preserve order, players' server-side actions and local actions are in the same order
				Therefore, the nth action of the server action list is the nth action of the local player.
				This allows to splice the first element of the local (unconfirmed) list every time we encounter an action of the local player
				*/
				if (action.requestedBy == Global.socket.id)
					localPointStack.splice(0, 1);

				// Creates a new brush path
				if (action.type == 'createBrush') {
					if (!serverActionsPerPlayer.get(action.requestedBy))
						serverActionsPerPlayer.set(action.requestedBy, [])
					serverActionsPerPlayer.get(action.requestedBy).push(serverTotalActions);
					const brushPoint = new BrushPoint(serverTotalActions++, new Point(action.data.point.x, action.data.point.y), action.data.color, action.data.size);
					// Twice because we need two points to make a point if the player clicks without moving
					serverActions.push(brushPoint);
					serverActions.push(brushPoint);
				}
				// Adds a point to the current path of the action's player
				else if (action.type == 'updateBrush') {
					if (!serverActionsPerPlayer.get(action.requestedBy))
						continue
					for (const point of action.data) {
						// We use the last point to determine the size and the color of the brush
						const lastAction = serverActionsPerPlayer.get(action.requestedBy)[serverActionsPerPlayer.get(action.requestedBy).length - 1];
						let lastPoint: BrushPoint = undefined;
						// findLast and findLastIndex are not compatible with firefox
						for (let i = serverActions.length - 1; i >= 0; i--) {
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
			for (let i = serverActions.length - 1; i >= 0; i--) {
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
		document.removeEventListener('mousedown', onMouseDown);
		canvas.removeEventListener('mouseenter', onMouseEnter);
		canvas.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', stopDrawing);
		document.removeEventListener('mouseleave', onMouseLeave);

	})

	function onMouseLeave(e: MouseEvent) {
		const distance = Math.sqrt(e.movementX * e.movementX + e.movementY * e.movementY);
		const angle = Math.atan2(e.movementY, e.movementX);
		const point = new Point(e.clientX - Math.cos(angle) * distance, e.clientY - Math.sin(angle) * distance).toRectSpace(canvas.getBoundingClientRect());
		point.x = Math.max(0, Math.min(point.x, canvas.width));
		point.y = Math.max(0, Math.min(point.y, canvas.height));

		Global.socket.emit('updateBrush', {points: [point]});
		stopDrawing(e);
	}

	function onMouseEnter(e: MouseEvent): void {
		if (!drawing)
			return;
		const distance = Math.sqrt(e.movementX * e.movementX + e.movementY * e.movementY);
		const angle = Math.atan2(e.movementY, e.movementX);
		const point = new Point(e.clientX - Math.cos(angle) * distance, e.clientY - Math.sin(angle) * distance).toRectSpace(canvas.getBoundingClientRect());
		point.x = Math.max(0, Math.min(point.x, canvas.width));
		point.y = Math.max(0, Math.min(point.y, canvas.height));

		createBrush(Global.socket.id, point, selectedColor, brushSize, ctx);
		Global.socket.emit('createBrush', { color: selectedColor, size: brushSize, point });
	}

	function onMouseDown(e: MouseEvent): void {
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
