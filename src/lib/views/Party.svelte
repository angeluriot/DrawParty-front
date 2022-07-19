<script lang="ts">
	import { Global } from '../shared/Global';
	import { onMount } from 'svelte';
	import { Player } from '../shared/Player';

	onMount(() =>
	{
		if (!Global.connected)
			window.location.href = '/';

		Global.socket.on('getPartyData', (players: {id: string, image: string}[]) =>
		{
			for (let player of players)
				Global.players = [...Global.players, new Player(player.id, player.image)];
		});

		Global.socket.on('newPlayer', (player: {id: string, image: string}) =>
		{
			Global.players = [...Global.players, new Player(player.id, player.image)];
		});

		Global.socket.on('removePlayer', (id: string) =>
		{
			Global.players = Global.players.filter(player => player.id !== id);
		});

		Global.socket.emit('askPartyData', Global.partyId);
	});
</script>

<span><b>{Global.partyId}</b></span>
<br/>
<br/>

{#each Global.players as player, i}
	{#if i === 0}
		<span><i>{player.id}</i></span>
		<br/>
	{:else}
		<span>{player.id}</span>
		<br/>
	{/if}
{/each}

<style>
</style>
