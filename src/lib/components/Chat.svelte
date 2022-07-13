<script lang="ts">
	import { onMount } from 'svelte';
	import { Global } from '../shared/Global';

	let input = '';
	let messages: { image: string, message: string }[] = [];

	onMount(async () =>
	{
		Global.socket.on('broadcastMessage', (user_id, message) =>
		{
			let user = Global.users.find(u => u.id === user_id);
			messages = [...messages, { image: user.image, message: message }];
		});
	});

	function sendMessage()
	{
		Global.socket.emit('message', Global.socket.id, input);
		let user = Global.users.find(u => u.id === Global.socket.id);
		messages = [...messages, { image: user.image, message: input }];
		input = '';
	}
</script>

<input type="text" bind:value={input}>
<button on:click={sendMessage}>Envoyer</button>

{#each messages as msg}
	<br/>
	<span>{msg.message}</span>
{/each}

<style>
</style>
