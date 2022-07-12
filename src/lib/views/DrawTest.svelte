<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { DrawAction, BrushAction } from "../shared/DrawAction";

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	const actionStack: DrawAction[] = []

	onMount(() => {
		ctx = canvas.getContext("2d");

		// Anti aliasing
		ctx.translate(0.5, 0.5);

		canvas.addEventListener('mousedown', onMouseDown)

		requestAnimationFrame(gameLoop);
	});

	onDestroy(() => {
		canvas.removeEventListener('mousedown', onMouseDown)
	})

	function onMouseDown(e: MouseEvent) {
		actionStack.push(new BrushAction(canvas, '#ff00ffff', 10));
	}

	function gameLoop(): void {
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		for (const action of actionStack) {
			action.draw(canvas, ctx);
		}
		requestAnimationFrame(gameLoop);
	}
</script>

<section>
	<canvas bind:this={canvas} width="800" height="600"></canvas>
</section>

<style>
	section {
		background-color: #ca0000ff;
	}
</style>
