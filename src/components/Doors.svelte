<script>
  import Clickable from './Clickable.svelte'

  let doors = [
  './images/Caroline/caroline_door.png',
  './images/Ena/ena_door.png',
  './images/Iris/iris_door.PNG',
]

</script>

<svelte:head>
  <link href="https://fonts.googleapis.com/css?family=Press+Start+2P&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css?family=Caveat&display=swap" rel="stylesheet">
</svelte:head>

<main>
  <h1>Overtenking</h1>
  <section class="doors">
    {#each doors as door, i}
       <Clickable  src='{doors[i]}' show='hidden' myNumber={i}/>
    {/each}
  </section>

</main>


<style>

  main {
    background-color: #fdd5d5;
    overflow: hidden;
    height: 100vh;
    display: grid;
  }


  h1 {
    margin: 0;
    margin-top: 10vh;
    padding: 0;
    justify-self: center;
    font-size: 3rem;
    font-family: 'Caveat';
  }

  .doors {
    display: grid;
    grid-auto-flow: column;
    place-items: center;
    overflow: hidden;
  }

</style>