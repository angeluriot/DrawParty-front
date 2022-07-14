<script lang="ts">
import { onDestroy } from 'svelte';

	import Router from 'svelte-spa-router';
	import Global from './lib/shared/global';
	import {routes} from './routes.js';

	onDestroy(() => {
		if (Global.socket.connected)
			Global.socket.disconnect();
	})
</script>

<body>
	<Router routes={routes} />
</body>

<style>
	:root {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
			Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
	}

	body {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}
</style>
