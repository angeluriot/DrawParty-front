<script lang="ts">
	import { onMount } from 'svelte';
	import { Global } from '../shared/Global';

	let input = '';
	let messages: { image: string, text: string }[] = [];

	onMount(() =>
	{
		Global.socket.on('broadcastMessage', (player_id: string, message: string) =>
		{
			let player = Global.players.get(player_id);
			messages = [...messages, { image: player.image, text: message }];
		});
	});

	function sendMessage()
	{
		Global.socket.emit('message', input);
		let player = Global.players.get(Global.socket.id);
		messages = [...messages, { image: player.image, text: input }];
		input = '';
	}
</script>

<input type="text" bind:value={input}>
<button on:click={sendMessage}>Envoyer</button>

{#each messages as message}
	<br/>
	<div class="inline-block">
		<img src={message.image} alt="profile" class="inline-block" width="50" height="50" />
		<span class="inline-block">{message.text}</span>
	</div>
{/each}

<style>
</style>
