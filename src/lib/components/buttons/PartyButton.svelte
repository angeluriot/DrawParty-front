<script lang="ts">
	import createParty from '../../../assets/shapes/createParty.svg';
	import joinParty from '../../../assets/shapes/joinParty.svg';

	export let type: string;
	export let onClick: () => void;
</script>

<div>
	<img src={type === 'create' ? createParty : joinParty} alt={type === 'create' ? "create party" : "join party"} on:click={onClick}/>
</div>

<style>
div
{
	filter: drop-shadow(0rem 0.5rem 0rem #63000016);
}

img
{
	width: 12rem;
	transition: transform 0.12s ease-in-out;
	cursor: pointer;
}

img:hover
{
	transform: scale(1.04);
}

img:active
{
	transform: scale(1);
}
</style>
