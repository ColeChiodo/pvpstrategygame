import * as k8s from "@kubernetes/client-node";
import prisma from "../config/database";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

const GAME_SERVER_NAMESPACE = "game-servers";
const GAME_SERVER_IMAGE = "localhost/fortezza-tactics-game-server:latest";
const GAME_SERVER_REPLICAS = 1;

export async function createGameServer(gameId: string): Promise<{ url: string; port: number } | null> {
  try {
    const deploymentName = `game-server-${gameId}`;
    const serviceName = `game-server-${gameId}`;
    const port = 3000 + Math.floor(Math.random() * 1000);

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
                imagePullPolicy: "Never",
                ports: [{ containerPort: port, name: "game" }],
                env: [
                  { name: "GAME_ID", value: gameId },
                  { name: "PORT", value: port.toString() },
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
              },
            ],
          },
        },
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
      },
      spec: {
        selector: {
          app: deploymentName,
        },
        ports: [
          { protocol: "TCP", port: port, targetPort: port, name: "game" },
        ],
        type: "ClusterIP",
      },
    };

    await k8sAppsApi.createNamespacedDeployment({
      namespace: GAME_SERVER_NAMESPACE,
      body: deployment,
    });

    await k8sApi.createNamespacedService({
      namespace: GAME_SERVER_NAMESPACE,
      body: service,
    });

    const serverUrl = `ws://${serviceName}.${GAME_SERVER_NAMESPACE}.svc.cluster.local:${port}`;

    await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        serverUrl: `ws://${serviceName}.${GAME_SERVER_NAMESPACE}.svc.cluster.local`,
        port,
        status: "in_progress",
      },
    });

    console.log(`Game server created: ${deploymentName} on port ${port}`);
    return { url: serverUrl, port };

  } catch (error) {
    console.error("Failed to create game server:", error);
    return null;
  }
}

export async function destroyGameServer(gameId: string): Promise<boolean> {
  try {
    const deploymentName = `game-server-${gameId}`;
    const serviceName = `game-server-${gameId}`;

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
