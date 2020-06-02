<script>
import Doors from './components/Doors.svelte'

let sound = './lofi.mp3'

let status = ''
if(innerWidth/innerHeight < 1.4 ) status = 'this page can only be viewed on a bigger screen...'

</script>

<main>
	<Doors />
	<audio src={sound} autoplay loop></audio>
	{#if status!=""}
		<h1>{status}</h1>
	{/if}
</main>

<style>

h1 {
	width:100vw;
	height:100vh;
	display:grid;
	place-items:center;
	position:fixed;
	top:0;
	left:0;
	overflow: hidden;
}

:global(*) {
	box-sizing: border-box;
}

:global(html, body, main) {
	margin: 0;
	padding: 0;
}

</style>