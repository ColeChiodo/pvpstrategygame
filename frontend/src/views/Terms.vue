<template>
  <div class="page-container">
    <PageHeader />

    <main class="page-content">
      <div class="terms-section">
        <h1 class="page-title">Terms of Service</h1>
        <p class="terms-intro">
          By using this game, you agree to comply with and be bound by the
          following terms and conditions. Please read them carefully before
          playing. If you do not agree with these terms, you are not authorized
          to use the game.
        </p>
      </div>

      <div class="terms-section">
        <h2 class="section-title">User Rights</h2>
        <p class="section-text">
          As a player, you are granted a non-exclusive, non-transferable license
          to access and use the game for personal, non-commercial purposes. You
          agree to follow all rules, including those set by the game
          administrators, and respect the community.
        </p>
        <p class="section-text">
          You are responsible for any activity that occurs under your account.
          You agree not to engage in cheating, harassment, or any behavior that
          violates the integrity and enjoyment of the game for other players.
        </p>
      </div>

      <div class="terms-section">
        <h2 class="section-title">Prohibited Activities</h2>
        <p class="section-text">
          The following activities are strictly prohibited in the game:
        </p>
        <ul class="section-list">
          <li>Exploiting bugs or glitches to gain an unfair advantage.</li>
          <li>
            Engaging in any form of harassment or abusive behavior towards other
            players.
          </li>
          <li>Attempting to hack or alter the game files or server.</li>
          <li>Spamming, phishing, or distributing malware through the game.</li>
          <li>
            Engaging in any illegal activity or violating the laws of your
            jurisdiction.
          </li>
        </ul>
      </div>

      <div class="terms-section">
        <h2 class="section-title">Termination and Suspension</h2>
        <p class="section-text">
          We reserve the right to suspend or terminate your access to the game
          at any time for violating these Terms of Service. If your account is
          suspended or terminated, you may not be entitled to a refund of any
          in-game purchases.
        </p>
      </div>

      <div class="terms-section">
        <h2 class="section-title">Privacy and Data</h2>
        <p class="section-text">
          Your privacy is important to us. By using the game, you agree to our
          collection, use, and sharing of personal data as described in our
          Privacy Policy. We may collect certain information, such as your IP
          address and gameplay data, to improve the game experience and ensure
          fair play.
        </p>
      </div>

      <div class="terms-section">
        <h2 class="section-title">Limitation of Liability</h2>
        <p class="section-text">
          To the maximum extent permitted by law, we shall not be held liable
          for any damages arising from your use or inability to use the game.
          This includes but is not limited to loss of data, gameplay
          interruptions, or any other issues resulting from the game's
          performance.
        </p>
      </div>

      <div class="terms-section">
        <h2 class="section-title">Changes to Terms</h2>
        <p class="section-text">
          We may update these Terms of Service from time to time. Any changes
          will be reflected on this page, and we encourage you to review the
          terms periodically. Your continued use of the game after any updates
          constitutes your acceptance of the new terms.
        </p>
      </div>

      <div class="terms-section">
        <h2 class="section-title">Contact Information</h2>
        <p class="section-text">
          If you have any questions about these Terms of Service, please contact
          <a href="mailto:support@fortezzatactics.online" class="contact-link"
            >support@fortezzatactics.online</a
          >
        </p>
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

.page-title {
  color: white;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.terms-section {
  width: 100%;
  margin-bottom: 2rem;
}

.terms-intro {
  color: white;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.section-title {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.section-text {
  color: white;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.section-list {
  color: white;
  font-size: 1rem;
  line-height: 1.8;
  margin-left: 1.5rem;
  margin-top: 0.5rem;
}

.section-list li {
  margin-bottom: 0.5rem;
}

.contact-link {
  color: var(--color-accent);
  text-decoration: underline;
}

.contact-link:hover {
  color: var(--color-cyan-600);
}
</style>
