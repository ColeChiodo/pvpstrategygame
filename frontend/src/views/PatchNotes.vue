<template>
  <div class="page-container">
    <PageHeader />

    <main class="page-content">
      <div class="page-header-section">
        <h1 class="page-title">Patch Notes</h1>
        <p class="page-subtitle">Current Build: {{ latestVersion }}</p>
        <p v-if="lastUpdated" class="page-subtitle">Last Updated: {{ lastUpdated }}</p>
        <button v-if="authStore.isAdmin" @click="showCreateModal = true" class="add-patch-btn">
          + Add Patch Note
        </button>
      </div>

      <hr class="divider" />

      <div class="patch-section">
        <div v-if="loading && patchNotes.length === 0" class="loading">
          Loading...
        </div>

        <div v-else-if="patchNotes.length === 0" class="no-patches">
          No patch notes yet.
        </div>

        <div v-else>
          <div v-for="patch in patchNotes" :key="patch.id" class="patch-card">
            <div class="patch-card-header">
              <div class="patch-card-title">
                <h2 class="patch-version">{{ patch.title }}</h2>
                <h3 class="patch-version-sub">{{ patch.version }}</h3>
              </div>
              <div v-if="authStore.isAdmin" class="admin-actions">
                <button @click="openEditModal(patch)" class="edit-btn">Edit</button>
                <button @click="deletePatchNote(patch.id)" class="delete-btn">Delete</button>
              </div>
            </div>

            <img
              v-if="patch.imageUrl"
              :src="getImageUrl(patch.imageUrl)"
              alt="Patch notes screenshot"
              class="patch-image"
            />

            <div class="patch-content" v-html="patch.content"></div>

            <p class="patch-date">{{ formatDate(patch.createdAt) }}</p>
          </div>
        </div>

        <div v-if="hasMore" class="load-more">
          <button @click="loadMore" class="load-more-btn" :disabled="loading">
            {{ loading ? "Loading..." : "Load More" }}
          </button>
        </div>
      </div>
    </main>

    <Footer />

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="create-modal">
        <div class="create-modal-header">
          <h2 class="create-modal-title">Create Patch Note</h2>
          <button class="close-modal-btn" @click="showCreateModal = false">X</button>
        </div>

        <form @submit.prevent="createPatchNote" class="create-form">
          <div class="form-group">
            <label class="form-label">Version</label>
            <input
              v-model="newPatch.version"
              type="text"
              class="form-input"
              placeholder="v0.2.0"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Title</label>
            <input
              v-model="newPatch.title"
              type="text"
              class="form-input"
              placeholder="New Features!"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Content (HTML)</label>
            <textarea
              v-model="newPatch.content"
              class="form-textarea"
              placeholder="<p>Your patch notes content here...</p>"
              rows="6"
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              @change="handleImageUpload"
              class="form-file"
            />
            <div v-if="uploading" class="upload-status">Uploading...</div>
            <div v-if="newPatch.imageUrl" class="upload-success">Image uploaded!</div>
          </div>

          <div class="form-actions">
            <button type="button" @click="showCreateModal = false" class="cancel-btn">
              Cancel
            </button>
            <button type="submit" class="submit-btn" :disabled="submitting">
              {{ submitting ? "Creating..." : "Create Patch Note" }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="create-modal">
        <div class="create-modal-header">
          <h2 class="create-modal-title">Edit Patch Note</h2>
          <button class="close-modal-btn" @click="showEditModal = false">X</button>
        </div>

        <form @submit.prevent="updatePatchNote" class="create-form">
          <div class="form-group">
            <label class="form-label">Version</label>
            <input
              v-model="editPatch.version"
              type="text"
              class="form-input"
              placeholder="v0.2.0"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Title</label>
            <input
              v-model="editPatch.title"
              type="text"
              class="form-input"
              placeholder="New Features!"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Content (HTML)</label>
            <textarea
              v-model="editPatch.content"
              class="form-textarea"
              placeholder="<p>Your patch notes content here...</p>"
              rows="6"
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              @change="handleEditImageUpload"
              class="form-file"
            />
            <div v-if="uploading" class="upload-status">Uploading...</div>
            <div v-if="editPatch.imageUrl" class="upload-success">Image uploaded!</div>
          </div>

          <div class="form-actions">
            <button type="button" @click="showEditModal = false" class="cancel-btn">
              Cancel
            </button>
            <button type="submit" class="submit-btn" :disabled="submitting">
              {{ submitting ? "Saving..." : "Save Changes" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import Footer from "../components/Footer.vue";
import { useAuthStore } from "../stores/auth";

interface PatchNote {
  id: string;
  version: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

const authStore = useAuthStore();
const patchNotes = ref<PatchNote[]>([]);
const loading = ref(false);
const page = ref(1);
const hasMore = ref(true);
const latestVersion = ref("v0.1.0");
const lastUpdated = ref("");
const showCreateModal = ref(false);
const showEditModal = ref(false);
const submitting = ref(false);
const uploading = ref(false);

const newPatch = ref({
  version: "",
  title: "",
  content: "",
  imageUrl: "",
});

const editPatch = ref({
  id: "",
  version: "",
  title: "",
  content: "",
  imageUrl: "",
});

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getImageUrl = (imageUrl: string | null) => {
  if (!imageUrl) return null;
  return `${import.meta.env.VITE_API_URL}${imageUrl}`;
};

const fetchPatchNotes = async (pageNum: number) => {
  loading.value = true;
  try {
    const response = await fetch(`/api/patch-notes?page=${pageNum}`);
    const data = await response.json();
    
    if (pageNum === 1) {
      patchNotes.value = data.patchNotes;
    } else {
      patchNotes.value.push(...data.patchNotes);
    }
    
    hasMore.value = data.hasMore;
    page.value = data.page;
  } catch (err) {
    console.error("Failed to fetch patch notes:", err);
  } finally {
    loading.value = false;
  }
};

const fetchLatestVersion = async () => {
  try {
    const response = await fetch("/api/patch-notes/latest");
    const data = await response.json();
    latestVersion.value = data.version;
  } catch (err) {
    console.error("Failed to fetch latest version:", err);
  }
};

const loadMore = () => {
  fetchPatchNotes(page.value + 1);
};

const handleImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  uploading.value = true;
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("/api/patch-notes/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      newPatch.value.imageUrl = data.url;
    }
  } catch (err) {
    console.error("Failed to upload image:", err);
  } finally {
    uploading.value = false;
  }
};

const createPatchNote = async () => {
  submitting.value = true;
  try {
    const response = await fetch("/api/patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(newPatch.value),
    });

    if (response.ok) {
      showCreateModal.value = false;
      newPatch.value = { version: "", title: "", content: "", imageUrl: "" };
      fetchPatchNotes(1);
      fetchLatestVersion();
    }
  } catch (err) {
    console.error("Failed to create patch note:", err);
  } finally {
    submitting.value = false;
  }
};

const openEditModal = (patch: PatchNote) => {
  editPatch.value = {
    id: patch.id,
    version: patch.version,
    title: patch.title,
    content: patch.content,
    imageUrl: patch.imageUrl || "",
  };
  showEditModal.value = true;
};

const handleEditImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  uploading.value = true;
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("/api/patch-notes/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      editPatch.value.imageUrl = data.url;
    }
  } catch (err) {
    console.error("Failed to upload image:", err);
  } finally {
    uploading.value = false;
  }
};

const updatePatchNote = async () => {
  submitting.value = true;
  try {
    const response = await fetch(`/api/patch-notes/${editPatch.value.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(editPatch.value),
    });

    if (response.ok) {
      showEditModal.value = false;
      fetchPatchNotes(1);
      fetchLatestVersion();
    }
  } catch (err) {
    console.error("Failed to update patch note:", err);
  } finally {
    submitting.value = false;
  }
};

const deletePatchNote = async (id: string) => {
  if (!confirm("Are you sure you want to delete this patch note?")) return;

  try {
    const response = await fetch(`/api/patch-notes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      fetchPatchNotes(1);
      fetchLatestVersion();
    }
  } catch (err) {
    console.error("Failed to delete patch note:", err);
  }
};

onMounted(() => {
  fetchPatchNotes(1);
  fetchLatestVersion();
});
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

.page-header-section {
  text-align: center;
  padding: 2rem 0;
  width: 100%;
}

.page-title {
  color: white;
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--color-gray-500);
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.add-patch-btn {
  margin-top: 1rem;
  background-color: var(--color-emerald-500);
  color: white;
  font-weight: bold;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  border: none;
  border-bottom: 4px solid var(--color-emerald-700);
  border-right: 4px solid var(--color-emerald-700);
  cursor: pointer;
  transition: all 0.1s;
}

.add-patch-btn:hover {
  filter: brightness(1.1);
}

.divider {
  width: 100%;
  border: none;
  border-top: 2px solid rgba(255, 255, 255, 0.2);
  margin: 1rem 0;
}

.patch-section {
  width: 100%;
}

.loading, .no-patches {
  color: var(--color-gray-400);
  text-align: center;
  padding: 2rem;
}

.patch-card {
  background-color: var(--color-secondary);
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 4px solid var(--color-secondary);
  margin-bottom: 1.5rem;
}

.patch-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.patch-card-title {
  flex: 1;
}

.admin-actions {
  display: flex;
  gap: 0.5rem;
}

.edit-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-amber-600);
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.edit-btn:hover {
  filter: brightness(1.1);
}

.delete-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-rose-600);
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.delete-btn:hover {
  filter: brightness(1.1);
}

.patch-version {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.patch-version-sub {
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.patch-image {
  width: 100%;
  height: auto;
  margin-bottom: 1rem;
  border-radius: 0.25rem;
}

.patch-content {
  color: white;
  margin-bottom: 1rem;
  line-height: 1.6;
}

.patch-content :deep(p) {
  margin-bottom: 1rem;
}

.patch-date {
  color: var(--color-gray-500);
  font-size: 0.875rem;
  margin-top: 1rem;
}

.load-more {
  text-align: center;
  margin-top: 1.5rem;
}

.load-more-btn {
  background-color: var(--color-emerald-500);
  color: white;
  font-weight: bold;
  padding: 0.875rem 2rem;
  border-radius: 0.5rem;
  border: none;
  border-bottom: 4px solid var(--color-emerald-700);
  border-right: 4px solid var(--color-emerald-700);
  cursor: pointer;
  transition: all 0.1s;
}

.load-more-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.create-modal {
  background-color: var(--color-secondary);
  padding: 2rem;
  border-radius: 1rem;
  border-bottom: 4px solid var(--color-primary);
  border-right: 4px solid var(--color-primary);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.create-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.create-modal-title {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.close-modal-btn {
  color: white;
  font-size: 1.25rem;
  font-weight: bold;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}

.close-modal-btn:hover {
  color: var(--color-primary);
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
}

.form-input,
.form-textarea {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 2px solid var(--color-gray-600);
  background-color: var(--color-primary);
  color: white;
  font-size: 1rem;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.form-file {
  color: white;
  font-size: 0.875rem;
}

.upload-status {
  color: var(--color-amber-500);
  font-size: 0.875rem;
}

.upload-success {
  color: var(--color-emerald-500);
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.cancel-btn {
  flex: 1;
  padding: 0.875rem;
  background-color: var(--color-gray-600);
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.submit-btn {
  flex: 1;
  padding: 0.875rem;
  background-color: var(--color-emerald-500);
  color: white;
  font-weight: bold;
  border: none;
  border-bottom: 4px solid var(--color-emerald-700);
  border-right: 4px solid var(--color-emerald-700);
  border-radius: 0.5rem;
  cursor: pointer;
}

.submit-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
