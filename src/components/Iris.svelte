<script>
	import Parallax from 'parallax-js'
  import { fade } from 'svelte/transition'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

	let doorIcon = './images/door_icon.png';

	let polaroid1 = ''
	let polaroid2 = ''
	let polaroid3 = ''

	let backImage = './images/Iris/iris_background.png'

  
	let images = [
		'./images/Iris/iris_room.PNG',
		'./images/Iris/iris_mirror.PNG', 
		'./images/Iris/iris_character.PNG', 
		'./images/Iris/iris_computer.PNG', 
		'./images/Iris/iris_forground1.PNG', 
		'./images/Iris/iris_forground2.PNG', 
  ]
  
    let polaroid = [
      './images/Iris/iris_polaroid1.PNG',
      './images/Iris/iris_polaroid2.PNG',
      './images/Iris/iris_polaroid3.PNG',
    ]

	let parallaxInstance
	const ready = node => {
		parallaxInstance = new Parallax(node)
		parallaxInstance.scalar(20.0)
		parallaxInstance.invert(false, false)
	}

	$: active = (polaroid1 || polaroid2 || polaroid3) ? true : false

</script>

<main >
		<section>
			<img src='{backImage}' class='backImage' alt='Background' />
			<div data-pointer-events='true' use:ready>
				<div data-depth='.13'>
						<img src='{images[0]}' alt='parallax' class='room' />
				</div>
				<div data-depth='.08'>
					<img on:click={() =>  { polaroid1 = active ? polaroid1 : !polaroid1} } src='{images[1]}' alt='parallax' class='mirror' />
				</div>
				<div data-depth='.18'>
						<img on:click={() =>  {polaroid2 = active ? polaroid2 : !polaroid2} } src='{images[2]}' alt='parallax' class='character'>
				</div>
				<div data-depth='.13'>
						<img on:click={() =>  {polaroid3 = active ? polaroid3 : !polaroid3 } } src='{images[3]}' alt='parallax' class='computer'>
				</div>
				<div data-depth='.08'>
						<img src='{images[4]}' alt='parallax' class='forground1'>
				</div>
				<div data-depth='.12'>
						<img src='{images[5]}' alt='parallax' class='forground2'>
				</div>
			</div>
		</section>
	{#if polaroid1}
		<section on:click={() =>  polaroid1 = !polaroid1 } in:fade out:fade class='fixed'>
			<img src='{polaroid[0]}' alt='polaroid' class='polaroid1' />
		</section>
	{/if}
	{#if polaroid2}
	<section on:click={() =>  polaroid2 = !polaroid2 } in:fade out:fade class='fixed'>
		<img src='{polaroid[1]}' alt='polaroid' class='polaroid1' />
	</section>
	{/if}
	 {#if polaroid3}
		<section on:click={() =>  polaroid3 = !polaroid3 } in:fade out:fade class='fixed'>
			<img src='{polaroid[2]}' alt='polaroid' class='polaroid1' />
		</section>
	{/if}

</main>
<img on:click={() => dispatch('hideMe')} src='{doorIcon}' alt='doorIcon' class='door-icon'/>




<style>
	main {
		display: grid;
		height: 100vh;
		width: 100vw;
		place-items: center;
		overflow: hidden;
		position: fixed;
		top: 0;
		left: 0;
	}

	.backImage {
		width: 100vw;
		position: absolute;
		top: 0vh;
	}

	.door-icon {
		position: absolute;
		left: 1rem;
		top: 1rem;
		width: 35px;
		cursor: pointer;
	}

	.room {
		width: 110vw;
		margin-left: -5vw;
		margin-top: -2vh;
		cursor: default;

	}

	.mirror {
		position: absolute;
    cursor: pointer;
		width: 80px;
		top: 40vh;
    left: 1vw;
	}

	.character {
    position: absolute;
    cursor: pointer;
		width: 580px;
		top: 70vh;
    left: 25vw;
	}

	.computer {
    position: absolute;
    cursor: pointer;
		width: 600px;
    top: 30vh;
		left: 57vw;
	}

	.forground1 {
    position: absolute;
		width: 400px;
    top: 67vh;
		left: -2vw;
	}

	.forground2 {
    position: absolute;
		width: 450px;
    top: 70vh;
		left: 78vw;
	}

	section {
		position:fixed;
		top:0;
		left:0;
		display: grid;
		place-items: center;
		font-size: 4rem;
		width: 100vw;
		height: 100vh;
		z-index: 1;
	}

 	section img {
		 width: 80vw;
	}

</style>
