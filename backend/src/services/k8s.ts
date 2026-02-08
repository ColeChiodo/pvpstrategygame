import * as k8s from "@kubernetes/client-node";
import prisma from "../config/database";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

const GAME_SERVER_NAMESPACE = "game-servers";
const GAME_SERVER_IMAGE = "colechiodo/fortezza-game-server:latest";
const GAME_SERVER_REPLICAS = 1;

export async function createGameServer(gameId: string): Promise<{ url: string; port: number } | null> {
  try {
    const deploymentName = `game-server-${gameId}`;
    const serviceName = `game-server-${gameId}`;
    const containerPort = 3000;

    const deployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: deploymentName,
        namespace: GAME_SERVER_NAMESPACE,
        labels: {
          app: deploymentName,
          gameId,
        },
      },
      spec: {
        replicas: GAME_SERVER_REPLICAS,
        selector: {
          matchLabels: {
            app: deploymentName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: deploymentName,
              gameId,
            },
          },
          spec: {
            containers: [
              {
                name: "game-server",
                image: GAME_SERVER_IMAGE,
                imagePullPolicy: "Always",
                ports: [{ containerPort, name: "game" }],
                env: [
                  { name: "GAME_ID", value: gameId },
                  { name: "PORT", value: containerPort.toString() },
                  { name: "ALLOWED_ORIGINS", value: process.env.FRONTEND_URL || "" },
                ],
                resources: {
                  limits: {
                    memory: "256Mi",
                    cpu: "250m",
                  },
                  requests: {
                    memory: "128Mi",
                    cpu: "100m",
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: "/health",
                    port: containerPort,
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/health",
                    port: containerPort,
                  },
                  initialDelaySeconds: 3,
                  periodSeconds: 5,
                },
              },
            ],
          },
        },
        ttlSecondsAfterFinished: 3600,
      },
    };

    const service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: serviceName,
        namespace: GAME_SERVER_NAMESPACE,
        labels: {
          app: deploymentName,
        },
        annotations: {
          "traefik.ingress.kubernetes.io/service.serversscheme": "ws",
        },
      },
      spec: {
        selector: {
          app: deploymentName,
        },
        ports: [
          { protocol: "TCP", port: containerPort, targetPort: containerPort, name: "game" },
        ],
        type: "ClusterIP",
      },
    };

    const GAME_SERVER_DOMAIN = process.env.GAME_SERVER_DOMAIN || "fortezza.colechiodo.cc";

    const ingress = {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: `game-server-${gameId}`,
        namespace: GAME_SERVER_NAMESPACE,
        annotations: {
          "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
          "traefik.ingress.kubernetes.io/router.tls": "true",
        },
      },
      spec: {
        ingressClassName: "traefik",
        rules: [
          {
            host: GAME_SERVER_DOMAIN,
            http: {
              paths: [
                {
                  path: `/game-${gameId}`,
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name: serviceName,
                      port: { number: containerPort },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };

    await k8sApi.createNamespacedService({
      namespace: GAME_SERVER_NAMESPACE,
      body: service,
    });

    const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    await k8sNetworkingApi.createNamespacedIngress({
      namespace: GAME_SERVER_NAMESPACE,
      body: ingress,
    });

    const serverUrl = `wss://${GAME_SERVER_DOMAIN}/game-${gameId}`;

    await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        serverUrl,
        status: "in_progress",
      },
    });

    console.log(`Game server created: ${deploymentName}`);
    return { url: serverUrl, port: containerPort };

  } catch (error) {
    console.error("Failed to create game server:", error);
    return null;
  }
}
}

export async function destroyGameServer(gameId: string): Promise<boolean> {
  try {
    const deploymentName = `game-server-${gameId}`;
    const serviceName = `game-server-${gameId}`;
    const ingressName = `game-server-${gameId}`;

    const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    
    await k8sNetworkingApi.deleteNamespacedIngress({
      name: ingressName,
      namespace: GAME_SERVER_NAMESPACE,
    });

    await k8sAppsApi.deleteNamespacedDeployment({
      name: deploymentName,
      namespace: GAME_SERVER_NAMESPACE,
    });

    await k8sApi.deleteNamespacedService({
      name: serviceName,
      namespace: GAME_SERVER_NAMESPACE,
    });

    await prisma.gameSession.update({
      where: { id: gameId },
      data: { status: "completed" },
    });

    console.log(`Game server destroyed: ${deploymentName}`);
    return true;

  } catch (error) {
    console.error("Failed to destroy game server:", error);
    return false;
  }
}

export async function getGameServerStatus(gameId: string): Promise<{ running: boolean; url?: string }> {
  try {
    const deploymentName = `game-server-${gameId}`;
    
    await k8sAppsApi.readNamespacedDeployment({
      name: deploymentName,
      namespace: GAME_SERVER_NAMESPACE,
    });

    const session = await prisma.gameSession.findUnique({
      where: { id: gameId },
    });

    return {
      running: true,
      url: session?.serverUrl || undefined,
    };

  } catch (error) {
    return { running: false };
  }
}

export async function listActiveGameServers(): Promise<Array<{ gameId: string; status: string; age: string }>> {
  try {
    const deployments = await k8sAppsApi.listNamespacedDeployment({
      namespace: GAME_SERVER_NAMESPACE,
      labelSelector: "app=game-server",
    }) as any;

    const items = deployments.body?.items || [];
    return items.map((dep: any) => ({
      gameId: dep.metadata?.labels?.gameId || "unknown",
      status: dep.status?.readyReplicas ? "running" : "pending",
      age: dep.metadata?.creationTimestamp?.toString() || "unknown",
    }));

  } catch (error) {
    console.error("Failed to list game servers:", error);
    return [];
  }
}
