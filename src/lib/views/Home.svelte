<script lang="ts">
	import { io, Socket } from 'socket.io-client';
	import { onMount, onDestroy } from "svelte";

	const socket: Socket = io('http://localhost:3001');

	let inputMsg = '';
	let messages: string[] = [];

	onMount(async () => {
		socket.connect();
		socket.on('broadcastMessage', (msg) => {
			messages = [...messages, msg];
		});
	});

	onDestroy(async () => {
		socket.disconnect();
	});

	function sendMessage() {
		socket.emit('message', inputMsg);
		messages = [...messages, inputMsg];
		inputMsg = '';
	}
</script>

<h1>Insanely good chat app!</h1>

<input type="text" bind:value={inputMsg}>
<button on:click={sendMessage}>Envoyer</button>

{#each messages as msg}
	<br/>
	<span>{msg}</span>
{/each}

<style>
	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4rem;
		font-weight: 100;
		line-height: 1.1;
		margin: 2rem auto;
		max-width: 14rem;
	}

	@media (min-width: 480px) {
		h1 {
			max-width: none;
		}
	}
</style>
