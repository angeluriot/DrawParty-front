<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { DrawAction, BrushAction } from "../shared/DrawAction";
	import Global from "../shared/global";
	import Point from "../shared/Point";

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	const actions = new Map<number, DrawAction>();

	let selectedColor = '#000000';
	let brushSize = 3;

	onMount(() => {
		ctx = canvas.getContext("2d");

		// Anti-aliasing
		ctx.translate(0.5, 0.5);

		render();

		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mousemove', onMouseMove);

		Global.socket.on('createBrush', (data: any) => {
			actions.set(data.action.id, new BrushAction(canvas, data.action.color, data.action.size, data.action.point));
		});

		Global.socket.on('updateBrush', (data: any) => {
			if (actions.get(data.actionId)) {
				(actions.get(data.actionId) as BrushAction).path.push(data.point);
				render();
			}
		});
	});

	onDestroy(() => {
		canvas.removeEventListener('mousedown', onMouseDown)
	})

	function onMouseDown(e: MouseEvent) {
		if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)
			return;
		const point = new Point(e.clientX, e.clientY).toRectSpace(canvas.getBoundingClientRect());

		actions.set(actions.size - 1, new BrushAction(canvas, selectedColor, brushSize, point));
		Global.socket.emit('createBrush', { color: selectedColor, size: brushSize, point });

		render();
	}

	function onMouseMove(e: MouseEvent) {
		render();
	}


	function render(): void {
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const sortedActions = [...actions.entries()].sort()
		for (const entry of sortedActions) {
			entry[1].draw(canvas, ctx);
		}
	}

	function clearActions(): void {
		render();
	}
</script>

<section>
	<canvas bind:this={canvas} width="800" height="600"></canvas>
	<input type="color" bind:value={selectedColor}>
	<span>Brush size : {brushSize}</span>
	<input type="range" min="1" max="30" bind:value={brushSize}>
	<button on:click={clearActions}>Clear</button>
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
