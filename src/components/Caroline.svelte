<script>
	import Parallax from 'parallax-js'
  import { fade } from 'svelte/transition'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

	let polaroid1 = ''
	let polaroid2 = ''
	let polaroid3 = ''

	let doorIcon = './images/door_icon.png';
	let backImage = './images/Caroline/caroline_background.png'

	let images = [
		'./images/Caroline/caroline_room.png',
		'./images/Caroline/caroline_drink.png',
		'./images/Caroline/caroline_food.png',
		'./images/Caroline/caroline_clothes.png',
		'./images/Caroline/caroline_character.png',
		'./images/Caroline/caroline_bed.png',
		'./images/Caroline/caroline_plant.png',
		'./images/Caroline/caroline_table.png',
		'./images/Caroline/caroline_pillow.png',
		'./images/Caroline/caroline_sofa.png',
  ]
  
    let polaroid = [
      './images/Caroline/caroline_polaroid1.png',
      './images/Caroline/caroline_polaroid2.png',
      './images/Caroline/caroline_polaroid3.png',
    ]

	let parallaxInstance
	const ready = node => {
		parallaxInstance = new Parallax(node)
		parallaxInstance.scalar(20.0)
		parallaxInstance.invert(false, false)
  }
  
  $: active = (polaroid1 || polaroid2 || polaroid3 ) ? true : false

</script>

<main >
		<section>
			<img src='{backImage}' class='backImage' alt='Background' />
			<div data-pointer-events='true' use:ready>
				<div data-depth='.1'>
						<img src='{images[0]}' alt='parallax' class='room' />
				</div>
				<div data-depth='.15'>
						<img on:click={() =>  { polaroid2 = active ? polaroid2 : !polaroid2 }} src='{images[1]}' alt='parallax' class='drink'>
				</div>
				<div data-depth='.12'>
						<img on:click={() =>  { polaroid3 = active ? polaroid3 : !polaroid3 }} src='{images[2]}' alt='parallax' class='food'>
				</div>
				<div data-depth='.11'>
						<img on:click={() => { polaroid1 = active ? polaroid1 : !polaroid1 }} src='{images[3]}' alt='parallax' class='clothes'>
				</div>
				<div data-depth='.12'>
						<img src='{images[4]}' alt='parallax' class='character'>
				</div>
				<div data-depth='.08'>
						<img src='{images[5]}' alt='parallax' class='bed'>
				</div>
				<div data-depth='.12'>
						<img src='{images[6]}' alt='parallax' class='plant'>
				</div>
				<div data-depth='.12'>
						<img src='{images[7]}' alt='parallax' class='table'>
				</div>
				<div data-depth='.12'>
						<img src='{images[8]}' alt='parallax' class='pillow'>
				</div>
				<div data-depth='.12'>
						<img src='{images[9]}' alt='parallax' class='sofa'>
				</div>
			</div>
		</section>
    {#if polaroid1}
       <section on:click={() =>  polaroid1 = !polaroid1 } in:fade out:fade class='fixed'>
				<img src='{polaroid[1]}' alt='polaroid' class='polaroid1' />
			</section>
    {/if}
    {#if polaroid2}
       <section on:click={() =>  polaroid2 = !polaroid2 } in:fade out:fade class='fixed'>
				<img src='{polaroid[0]}' alt='polaroid' class='polaroid1' />
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
		cursor: default;
	}


	.backImage {
		z-index: 0;
		width: 120vw;
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
		width: 104vw;
		margin-left: -2vw;
		margin-top: -5vh;
	}

	.drink {
		position: absolute;
    cursor: pointer;
		width: 100px;
		top: 17vh;
    left: 8vw;
	}

	.food {
    position: absolute;
    cursor: pointer;
		width: 120px;
		top: 43.5vh;
    left: 58vw;
	}

	.clothes {
    position: absolute;
    cursor: pointer;
		width: 160px;
    top: 25vh;
		left: 28.5vw;
	}

	.character {
    position: absolute;
		width: 200px;
    top: 40vh;
		left: 7vw;
	}

	.bed {
    position: absolute;
		width: 450px;
    top: 13vh;
		left: 70vw;
	}

	.plant {
    position: absolute;
		width: 250px;
    top: 45vh;
		left: 35vw;
	}

	.table {
    position: absolute;
		width: 550px;
    top: 78vh;
		left: -5vw;
	}

	.pillow {
    position: absolute;
		width: 200px;
    top: 90vh;
		left: 45vw;
	}

	.sofa {
    position: absolute;
		width: 550px;
    top: 80vh;
		left: 55vw;
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
		 width: 40vw;
	}

</style>
