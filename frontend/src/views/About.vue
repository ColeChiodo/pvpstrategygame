<template>
  <div class="page-container">
    <PageHeader />

    <main class="page-content">
      <div class="about-section">
        <h2 class="section-title">Author</h2>
        <p class="section-text">
          Hi, I'm Cole Chiodo. A recent Computer Science Graduate with an
          interest in video games. Learn more on my
          <a href="http://colechiodo.cc" class="link" target="_blank"
            >personal site</a
          >.
        </p>
      </div>

      <div class="about-section">
        <h2 class="section-title">Project Description</h2>
        <p class="section-text">
          I decided to make this project while searching for a job to pass the
          time and improve my Software Engineering skills.
        </p>
        <p class="section-text">
          Fortezza Tactics Online is a turn based pvp strategy tactics game
          inspired by games such as:
        </p>
        <ul class="section-list">
          <li>Fire Emblem</li>
          <li>Advance Wars</li>
          <li>Triangle Strategy</li>
          <li>Final Fantasy Tactics</li>
        </ul>
      </div>

      <div class="about-section">
        <h2 class="section-title">How I Made It</h2>
        <p class="section-text">
          Fortezza Tactics Online was created using a combination of tools and
          technologies, including:
        </p>
        <ul class="section-list">
          <li>Node and Express backend using TypeScript</li>
          <li>Vue frontend</li>
          <li>PostgreSQL for storing user info, Redis for caching sessions</li>
          <li>Gameplay rendering using HTML canvas element</li>
          <li>Client-Server communication using WebSockets</li>
		  <li>Dockerized project. Kubernetes to orchestrate making of game servers</li>
        </ul>
      </div>

      <div class="about-section">
        <h2 class="section-title">Future Plans</h2>
        <p class="section-text">
          Looking ahead, I plan to continue working on this project
          incrementally. Some of the things I would like to include are:
        </p>
        <ul class="section-list">
          <li>Ranked Mode</li>
          <li>VS AI Mode</li>
          <li>Full Gamepad Support</li>
          <li>Add Complexity and Depth</li>
          <li>Steam Release (?)</li>
        </ul>
        <p class="section-text">Stay tuned for updates!</p>
      </div>

      <div class="about-section">
        <h2 class="section-title">Credits</h2>

        <h3 class="subsection-title">Art:</h3>
        <ul class="section-list">
          <li>
            "MiniFolks - Humans" pixel art characters by LYASeeK --
            <a
              href="https://lyaseek.itch.io/minifhumans"
              class="link"
              target="_blank"
              >https://lyaseek.itch.io/minifhumans</a
            >
          </li>
          <li>
            "Pixel Isometric: Village" tileset by Xilurus --
            <a
              href="https://xilurus.itch.io/pixel-isometric-village"
              class="link"
              target="_blank"
              >https://xilurus.itch.io/pixel-isometric-village</a
            >
          </li>
          <li>
            "Mountain Dusk Parallax" background by ansimuz --
            <a
              href="https://ansimuz.itch.io/mountain-dusk-parallax-background"
              class="link"
              target="_blank"
              >https://ansimuz.itch.io/mountain-dusk-parallax-background</a
            >
          </li>
          <li>"Free Sky Backgrounds" by CraftPix.net</li>
          <li>"Nature Landscapes Free Pixel Art" by CraftPix.net</li>
        </ul>

        <h3 class="subsection-title">Sounds:</h3>
        <ul class="section-list">
          <li>
            "step.wav" by _bepis --
            <a
              href="https://freesound.org/s/423196/"
              class="link"
              target="_blank"
              >https://freesound.org/s/423196/</a
            >
            -- License: Attribution 4.0
          </li>
        </ul>
      </div>
    </main>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import PageHeader from "../components/PageHeader.vue";
import Footer from "../components/Footer.vue";
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: var(--color-primary);
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.about-section {
  width: 100%;
  margin-bottom: 2rem;
}

.section-title {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.subsection-title {
  color: white;
  font-size: 1.125rem;
  font-weight: bold;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.section-text {
  color: white;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.section-list {
  color: white;
  font-size: 1rem;
  line-height: 1.8;
  margin-left: 1.5rem;
}

.section-list li {
  margin-bottom: 0.25rem;
}

.link {
  color: var(--color-accent);
  text-decoration: underline;
}

.link:hover {
  color: var(--color-cyan-600);
}
</style>
