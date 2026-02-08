<template>
  <div class="footer-wrapper">
    <div class="footer-transition-overlay">
      <img
        src="/assets/landing/footer_transition.png"
        alt="Footer Transition"
        class="footer-transition"
      />
    </div>
    <footer class="footer">
      <div class="footer-content">
		<p>&copy; {{ year }} <a href="https://colechiodo.cc" class="footer-link">colechiodo.cc</a></p>
        <p>All rights reserved.</p>
        <div class="footer-links">
          <a href="/patch-notes" class="footer-link">Patch Notes</a>
          <span class="divider">|</span>
          <a href="/terms" class="footer-link">Terms of Service</a>
          <span class="divider">|</span>
          <a href="/about" class="footer-link">About</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<style scoped>
.footer-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.footer-transition-overlay {
  position: relative;
  left: 0;
  top: 0;
  width: 100%;
  z-index: 10;
  pointer-events: none;
  background-color: #0f0f2b;
}

.footer-transition {
  width: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  margin-bottom: -20px;
}

.footer {
  background-color: #222034;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: white;
  text-align: center;
  margin-top: -1px;
}

.footer-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.footer-link {
  color: white;
  text-decoration: none;
}

.footer-link:hover {
  text-decoration: underline;
}

.divider {
  color: white;
}

@media (min-width: 1024px) {
  .footer-links {
    flex-wrap: nowrap;
  }
}
</style>
