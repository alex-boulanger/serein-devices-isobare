<script lang="ts">
  import ApplyBar from "./apply/ApplyBar.svelte";
  import HeaderBar from "./header/HeaderBar.svelte";
  import MacroSliders from "./macros/MacroSliders.svelte";
  import Matrix from "./matrix/Matrix.svelte";
  import { createSession, setSession } from "./session/session.svelte";

  setSession(createSession());
</script>

<svelte:head>
  <meta name="color-scheme" content="light" />
</svelte:head>

<main>
  <div class="workspace">
    <HeaderBar />
    <MacroSliders />
    <Matrix />
  </div>
  <ApplyBar />
</main>

<style>
  main {
    display: flex;
    height: 100vh;
    flex-direction: column;
    padding: var(--pad) var(--pad) 0;
  }

  .workspace {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }
</style>
