import { reactive, readonly } from "vue";

interface Alert {
  id: number;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

const state = reactive({
  alerts: [] as Alert[],
  nextId: 1,
});

export function showAlert(message: string, type: Alert["type"] = "info", duration: number = 4000) {
  const id = state.nextId++;
  state.alerts.push({ id, type, message });

  if (duration > 0) {
    setTimeout(() => {
      dismissAlert(id);
    }, duration);
  }

  return id;
}

export function dismissAlert(id: number) {
  const index = state.alerts.findIndex(a => a.id === id);
  if (index !== -1) {
    state.alerts.splice(index, 1);
  }
}

export function getAlerts() {
  return readonly(state).alerts;
}

export const alerts = {
  success: (message: string, duration?: number) => showAlert(message, "success", duration),
  error: (message: string, duration?: number) => showAlert(message, "error", duration),
  warning: (message: string, duration?: number) => showAlert(message, "warning", duration),
  info: (message: string, duration?: number) => showAlert(message, "info", duration),
  dismiss: dismissAlert,
  get: getAlerts,
};
