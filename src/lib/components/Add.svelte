<script lang="ts">
	export let width: number;
	export let height: number;
</script>

<div class="container flex justify-center items-center flex-col" style="width: {width}rem; height: {height}rem;">
	<div class="add"></div>
	<span>Please disable AdBlock :(</span>
</div>

<style>
.container
{
	position: relative;
	background-color: white;
	border-radius: 1.3rem;
	box-shadow: 0rem 0.5rem 0rem #63000016;
}

.add
{
	position: absolute;
	width: 85%;
	height: 85%;
}

span
{
	font-family: 'To-Japan';
	font-size: 1.4rem;
	color: #767684;
	padding: 2rem;
	text-align: center;
}
</style>
