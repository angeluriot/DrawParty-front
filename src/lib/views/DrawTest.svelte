<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { DrawAction, BrushAction } from "../shared/DrawAction";
	import Point from "../shared/Point";

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	const actionStack: DrawAction[] = []

	let selectedColor = '#000000';
	let brushSize = 3;

	onMount(() => {
		ctx = canvas.getContext("2d");

		// Anti-aliasing
		ctx.translate(0.5, 0.5);

		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mousemove', onMouseMove);

		render();
	});

	onDestroy(() => {
		canvas.removeEventListener('mousedown', onMouseDown)
	})

	function onMouseDown(e: MouseEvent) {
		actionStack.push(new BrushAction(canvas, selectedColor, brushSize, new Point(e.clientX, e.clientY).toRectSpace(canvas.getBoundingClientRect())));
		render();
	}

	function onMouseMove(e: MouseEvent) {
		render();
	}


	function render(): void {
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		for (const action of actionStack) {
			action.draw(canvas, ctx);
		}
	}
</script>

<section>
	<canvas bind:this={canvas} width="800" height="600"></canvas>
	<input type="color" bind:value={selectedColor}>
	<label>Brush size : {brushSize}</label>
	<input type="range" min="1" max="30" bind:value={brushSize}>
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
