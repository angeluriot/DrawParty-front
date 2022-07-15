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
	import BrushPoint from "../shared/BrushPoint";
	import Global from "../shared/global";
	import Point from "../shared/Point";
	import Action from "../shared/Action";

	/*
	The minimum normalized distance between two points of a path
	it is used to prevent small paths from having too many points
	*/
	const drawDistanceThreshold = 0.000006

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
	// This is the list of all current actions that hasn't been confirmed by the server yet
	const localActionStack: Action[] = [];
	const localUndos: number[] = [];

	// Server

	// Same as totalActions but increments only for confirmed actions, of any player
	let serverTotalActions = 0;
	/*
	List of action group ids per player, it is used to keep track of which path is owned by a player, etc.
	Therefore allowing to do things on an action group based on a player id
	*/
	const serverActionsPerPlayer = new Map<string, number[]>();
	// Same as localPointStack but for confirmed actions
	const serverActions: Action[] = [];
	const serverUndosPerPlayer = new Map<string, number[]>();

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
					localActionStack.splice(0, 1);

				if (action.type != 'undo' && action.type != 'redo' && action.type != 'updateBrush' && serverUndosPerPlayer.get(action.requestedBy)) {
					const ids = serverUndosPerPlayer.get(action.requestedBy);
					for (let i = 0; i < serverActions.length; i++)
						if (ids.indexOf(serverActions[i].id) != -1)
							serverActions.splice(i, 1);
					serverUndosPerPlayer.delete(action.requestedBy);
				}

				// Creates a new brush path
				if (action.type == 'createBrush') {
					if (!serverActionsPerPlayer.get(action.requestedBy))
						serverActionsPerPlayer.set(action.requestedBy, [])
					serverActionsPerPlayer.get(action.requestedBy).push(serverTotalActions);
					const brushPoint = new BrushPoint(new Point(action.data.point.x, action.data.point.y), action.data.color, action.data.size);
					const savedAction = new Action('brushPoint', brushPoint, serverTotalActions++);
					// Twice because we need two points to make a point if the player clicks without moving
					serverActions.push(savedAction);
					serverActions.push(savedAction);
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
							if (lastAction == serverActions[i].id) {
								lastPoint = serverActions[i].data;
								break;
							}
						}
						const brushPoint = new BrushPoint(new Point(point.x, point.y), lastPoint.color, lastPoint.brushSize);
						serverActions.push(new Action('brushPoint', brushPoint, lastAction));
					}
				}
				else if (action.type == 'undo') {
					if (!serverActionsPerPlayer.get(action.requestedBy))
						return;
					let pathId = -1;
					for (let i = serverActions.length - 1; i >= 0; i--)
					{
						if (pathId == -1 && serverActionsPerPlayer.get(action.requestedBy).indexOf(serverActions[i].id) != -1 && !serverActions[i].undone) {
							if (!serverUndosPerPlayer.get(action.requestedBy))
								serverUndosPerPlayer.set(action.requestedBy, []);
							pathId = serverActions[i].id;
							serverUndosPerPlayer.get(action.requestedBy).push(pathId);
							serverActions[i].undone = true;
						} else if (pathId == serverActions[i].id) {
							serverActions[i].undone = true;
						}
					}
				}
				else if (action.type == 'redo') {
					if (!serverActionsPerPlayer.get(action.requestedBy) || !serverUndosPerPlayer.get(action.requestedBy))
						return;
					let pathId = -1;
					const ids = serverUndosPerPlayer.get(action.requestedBy);
					for (let i = 0; i < serverActions.length - 1; i++)
					{
						if (pathId == -1 && ids.indexOf(serverActions[i].id) != -1) {
							pathId = serverActions[i].id;
							serverActions[i].undone = false;
						} else if (pathId == serverActions[i].id) {
							serverActions[i].undone = false;
						}
					}
					if (ids.length == 1)
						serverUndosPerPlayer.delete(action.requestedBy);
					else
						serverUndosPerPlayer.get(action.requestedBy).pop();
				}
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
		for (let i = 0; i < serverActions.length; i++)
			if (localUndos.indexOf(serverActions[i].id) != -1)
				serverActions.splice(i, 1);
		localUndos.length = 0;
	}

	function createBrush(playerId: string, point: Point, selectedColor: string, brushSize: number, ctx: CanvasRenderingContext2D): void {
		clearUndoStack();
		const brushPoint = new BrushPoint(new Point(point.x, point.y), selectedColor, brushSize);
		const action = new Action('brushPoint', brushPoint, totalActions++);
		localActionStack.push(action);
		localActionStack.push(action);
		brushPoint.drawLine(canvas, ctx, brushPoint);
	}

	function addPoint(playerId: string, point: Point): boolean {
		let lastPoint: BrushPoint = undefined;
		let pathId = 0;
		if (localActionStack.length > 0) {
			lastPoint = localActionStack[localActionStack.length - 1].data;
			pathId = localActionStack[localActionStack.length - 1].id;
		} else {
			pathId = serverActionsPerPlayer.get(Global.socket.id)[serverActionsPerPlayer.get(Global.socket.id).length - 1];
			// findLast and findLastIndex are not compatible with firefox
			for (let i = serverActions.length - 1; i >= 0; i--) {
				if (pathId == serverActions[i].id) {
					lastPoint = serverActions[i].data;
					break;
				}
			}
		}
		if (lastPoint && lastPoint.point.distanceSquared(point) < drawDistanceThreshold)
		return false;

		const brushPoint = new BrushPoint(new Point(point.x, point.y), lastPoint.color, lastPoint.brushSize);
		localActionStack.push(new Action('brushPoint', brushPoint, pathId));
		brushPoint.drawLine(canvas, ctx, lastPoint);
		return true;
	}

	onDestroy(() => {
		canvas.removeEventListener('mousedown', onMouseDown);
		canvas.removeEventListener('mouseenter', onMouseEnter);
		canvas.removeEventListener('mousemove', onMouseMove);
		canvas.removeEventListener('mouseup', stopDrawing);
		canvas.removeEventListener('mouseleave', onMouseLeave);
	})

	function onMouseLeave(e: MouseEvent) {
		const distance = Math.sqrt(e.movementX * e.movementX + e.movementY * e.movementY);
		const angle = Math.atan2(e.movementY, e.movementX);
		const point = new Point(e.clientX - Math.cos(angle) * distance, e.clientY - Math.sin(angle) * distance).toRectSpace(canvas.getBoundingClientRect())
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
		{
			localActionStack.length = 0;
			localUndos.length = 0;
			render();
			return;
		}
		if (!serverActionsPerPlayer.get(playerId))
			return;
		const pathIds = serverActionsPerPlayer.get(playerId);
		for (let i = 0; i < serverActions.length - 1; i++) {
			if (pathIds.indexOf(serverActions[i].id) != -1)
				serverActions.splice(i--, 1);
		}
	}

	function undo(): void {
		let pathId = -1;
		for (let i = localActionStack.length - 1; i >= 0; i--)
		{
			if (pathId == -1 && !localActionStack[i].undone) {
				pathId = localActionStack[i].id;
				localUndos.push(pathId);
				localActionStack[i].undone = true;
			} else if (pathId == localActionStack[i].id) {
				localActionStack[i].undone = true;
			}
		}
		render();
	}

	function redo(): void {
		if (localUndos.length == 0)
			return;
		let pathId = -1;
		for (let i = 0; i < localActionStack.length ; i++)
		{
			if (pathId == -1 && localActionStack[i].undone) {
				pathId = localActionStack[i].id;
				localActionStack[i].undone = false;
			} else if (pathId == localActionStack[i].id) {
				localActionStack[i].undone = false;
			}
		}
		localUndos.pop();
		render();
	}

	function undoButton(): void {
		undo();
		Global.socket.emit('undo');
	}

	function redoButton(): void {
		redo();
		Global.socket.emit('redo');
	}

	function render() {
		drawBackground();

		// Render server actions
		const serverLastPointPerGroup = new Map<number, number>();
		for (let i = 0; i < serverActions.length; i++) {
			if (serverLastPointPerGroup.get(serverActions[i].id) && !serverActions[i].undone)
				serverActions[i].data.drawLine(canvas, ctx, serverActions[serverLastPointPerGroup.get(serverActions[i].id)].data);
			serverLastPointPerGroup.set(serverActions[i].id, i);
		}

		// Render client local actions that server hasn't saved yet
		const lastPointPerGroup = new Map<number, number>();
		for (let i = 0; i < localActionStack.length; i++) {
			if (lastPointPerGroup.get(localActionStack[i].id) && !localActionStack[i].undone)
				localActionStack[i].data.drawLine(canvas, ctx, localActionStack[lastPointPerGroup.get(localActionStack[i].id)].data);
			lastPointPerGroup.set(localActionStack[i].id, i);
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
