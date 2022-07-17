<script lang="ts">
	import Router from 'svelte-spa-router';
	import PortraitAlert from './lib/components/PortraitAlert.svelte';
	import { routes } from './routes.js';
	import background from './assets/shapes/background.svg';
	import * as Utils from './lib/shared/utils';
	import './tailwind.css';
	import './fonts.css';
	import './global.css';

	let ratio;

	function updateAppSize()
	{
		let maxSize = 2.7;
		let minSize = 1.8;
		let final = maxSize;
		ratio = window.innerWidth / window.innerHeight;

		if (ratio < 16. / 9.)
		{
			let cursor = Math.max(Utils.getCursor(ratio, 1., 16. / 9.), 0.);
			final = Utils.getMix(minSize, maxSize, cursor);
		}

		(document.querySelector(':root') as HTMLDivElement).style.fontSize = final + 'vh';
	}

	window.addEventListener('resize', updateAppSize);
	setInterval(updateAppSize, 1000);
	updateAppSize();

</script>

<main>
	{#if ratio < 1.}
		<PortraitAlert />
	{/if}
	<Router routes={routes} />
</main>
<div class="background flex justify-center items-center"><img src={background} alt="background"/></div>

<style>
	main
	{
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

	.background
	{
		width: 100%;
		height: 100%;
		position: fixed;
		top: 0;
		left: 0;
		z-index: -1;
		overflow: hidden;
	}

	img
	{
		width: 100%;
		z-index: -1;
	}
</style>
