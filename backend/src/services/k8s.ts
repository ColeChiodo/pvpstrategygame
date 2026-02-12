import * as k8s from "@kubernetes/client-node";
import prisma from "../config/database";

const kc = new k8s.KubeConfig();

console.log("[K8S] KUBECONFIG env:", process.env.KUBECONFIG);

if (process.env.KUBECONFIG) {
  console.log("[K8S] Loading kubeconfig from:", process.env.KUBECONFIG);
  try {
    kc.loadFromFile(process.env.KUBECONFIG);
    console.log("[K8S] Kubeconfig loaded successfully");
  } catch (e) {
    console.error("[K8S] Failed to load kubeconfig:", e);
  }
} else {
  console.log("[K8S] No KUBECONFIG env, trying loadFromDefault");
  try {
    kc.loadFromDefault();
  } catch (e) {
    console.error("[K8S] Failed to loadFromDefault:", e);
  }
}

console.log("[K8S] Clusters:", kc.clusters.map(c => c.name));
console.log("[K8S] Current cluster:", kc.getCurrentCluster()?.name);
console.log("[K8S] Cluster server:", kc.getCurrentCluster()?.server);

kc.clusters.forEach(cluster => {
  console.log(`[K8S] Cluster ${cluster.name}: ${cluster.server}`);
});

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

const GAME_SERVER_NAMESPACE = "game-servers";
const GAME_SERVER_IMAGE = "colechiodo/fortezza-game-server:latest";
const GAME_SERVER_REPLICAS = 1;
const GAME_SERVER_PORT = 3000;
const GAME_SERVER_HOSTNAME = process.env.GAME_SERVER_HOSTNAME || "gamefortezza.colechiodo.cc";

async function createStripPrefixMiddleware(gameId: string, deploymentUid: string): Promise<boolean> {
  const middlewareName = `strip-game-prefix-${gameId}`;

  const middleware = {
    apiVersion: "traefik.io/v1alpha1",
    kind: "Middleware",
    metadata: {
      name: middlewareName,
      namespace: GAME_SERVER_NAMESPACE,
      ownerReferences: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: `game-server-${gameId}`,
          uid: deploymentUid,
        },
      ],
    },
    spec: {
      stripPrefix: {
        prefixes: [`/game/${gameId}`],
      },
    },
  };

  try {
    await k8sCustomApi.createNamespacedCustomObject({
      group: "traefik.io",
      version: "v1alpha1",
      namespace: GAME_SERVER_NAMESPACE,
      plural: "middlewares",
      body: middleware,
    });
    console.log(`[K8S] StripPrefix middleware created: ${middlewareName}`);
    return true;
  } catch (error: any) {
    if (error.statusCode === 409) {
      console.log(`[K8S] StripPrefix middleware already exists: ${middlewareName}`);
      return true;
    }
    console.error(`[K8S] Failed to create StripPrefix middleware:`, error.message);
    return false;
  }
}

async function createIngressRoute(gameId: string, serviceName: string, deploymentUid: string): Promise<boolean> {
  const ingressRouteName = `game-server-${gameId}`;

  const middlewareCreated = await createStripPrefixMiddleware(gameId, deploymentUid);
  if (!middlewareCreated) {
    console.error(`[K8S] Failed to create middleware, aborting IngressRoute creation`);
    return false;
  }

  const ingressRoute = {
    apiVersion: "traefik.io/v1alpha1",
    kind: "IngressRoute",
    metadata: {
      name: ingressRouteName,
      namespace: GAME_SERVER_NAMESPACE,
      ownerReferences: [
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          name: `game-server-${gameId}`,
          uid: deploymentUid,
        },
      ],
    },
    spec: {
      entryPoints: ["web", "websecure"],
      routes: [
        {
          match: `Host(\`${GAME_SERVER_HOSTNAME}\`) && PathPrefix(\`/game/${gameId}\`)`,
          kind: "Rule",
          middlewares: [
            {
              name: "game-headers",
              namespace: GAME_SERVER_NAMESPACE,
            },
            {
              name: `strip-game-prefix-${gameId}`,
              namespace: GAME_SERVER_NAMESPACE,
            },
          ],
          services: [
            {
              name: serviceName,
              port: GAME_SERVER_PORT,
            },
          ],
        },
      ],
    },
  };

  try {
    await k8sCustomApi.createNamespacedCustomObject({
      group: "traefik.io",
      version: "v1alpha1",
      namespace: GAME_SERVER_NAMESPACE,
      plural: "ingressroutes",
      body: ingressRoute,
    });
    console.log(`[K8S] IngressRoute created: ${ingressRouteName}`);
    return true;
  } catch (error: any) {
    console.error(`[K8S] Failed to create IngressRoute:`, error.message);
    return false;
  }
}

async function deleteStripPrefixMiddleware(gameId: string): Promise<boolean> {
  const middlewareName = `strip-game-prefix-${gameId}`;

  try {
    await k8sCustomApi.deleteNamespacedCustomObject({
      group: "traefik.io",
      version: "v1alpha1",
      namespace: GAME_SERVER_NAMESPACE,
      plural: "middlewares",
      name: middlewareName,
    });
    console.log(`[K8S] StripPrefix middleware deleted: ${middlewareName}`);
    return true;
  } catch (error: any) {
    if (error.statusCode !== 404) {
      console.error(`[K8S] Failed to delete StripPrefix middleware:`, error.message);
    }
    return false;
  }
}

async function deleteIngressRoute(gameId: string): Promise<boolean> {
  const ingressRouteName = `game-server-${gameId}`;

  try {
    await k8sCustomApi.deleteNamespacedCustomObject({
      group: "traefik.io",
      version: "v1alpha1",
      namespace: GAME_SERVER_NAMESPACE,
      plural: "ingressroutes",
      name: ingressRouteName,
    });
    console.log(`[K8S] IngressRoute deleted: ${ingressRouteName}`);
  } catch (error: any) {
    if (error.statusCode !== 404) {
      console.error(`[K8S] Failed to delete IngressRoute:`, error.message);
    }
  }

  // Also delete the middleware
  await deleteStripPrefixMiddleware(gameId);

  return true;
}

export async function createGameServer(gameId: string): Promise<{ url: string; port: number } | null> {
  console.log(`[K8S] createGameServer called for ${gameId}`);
  console.log(`[K8S] K8sApi ready:`, !!k8sAppsApi);
  
  try {
    const cluster = kc.getCurrentCluster();
    console.log(`[K8S] Attempting to reach ${cluster?.server}`);
    
    await k8sAppsApi.listNamespacedDeployment({ namespace: GAME_SERVER_NAMESPACE });
    console.log(`[K8S] K8s API is reachable`);
  } catch (apiError: any) {
    console.error(`[K8S] K8s API unreachable:`, apiError.message);
    console.log(`[K8S] Returning null - game server will not be created`);
    return null;
  }

  try {
    const deploymentName = `game-server-${gameId}`;
    const serviceName = `game-server-${gameId}`;

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
                ports: [{ containerPort: GAME_SERVER_PORT, name: "game" }],
                env: [
                  { name: "GAME_ID", value: gameId },
                  { name: "PORT", value: GAME_SERVER_PORT.toString() },
                  { name: "ALLOWED_ORIGINS", value: `${process.env.FRONTEND_URL || ""},${process.env.GAME_URL || ""}` },
                  { name: "BACKEND_URL", value: process.env.BACKEND_URL || "https://apifortezza.colechiodo.cc" },
                  { name: "GAME_SERVER_SECRET", value: process.env.GAME_SERVER_SECRET || "" },
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
                    port: GAME_SERVER_PORT,
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/health",
                    port: GAME_SERVER_PORT,
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

    await k8sAppsApi.createNamespacedDeployment({
      namespace: GAME_SERVER_NAMESPACE,
      body: deployment,
    });
    console.log(`Kubernetes pod created: ${deploymentName}`);

    const deploymentResponse = await k8sAppsApi.readNamespacedDeployment({
      name: deploymentName,
      namespace: GAME_SERVER_NAMESPACE,
    });
    const deploymentUid = (deploymentResponse as any).metadata?.uid;
    if (!deploymentUid) {
      console.error(`[K8S] Failed to get UID for deployment ${deploymentName}`);
      return null;
    }
    console.log(`[K8S] Deployment UID: ${deploymentUid}`);

    const service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: serviceName,
        namespace: GAME_SERVER_NAMESPACE,
        labels: {
          app: deploymentName,
        },
        ownerReferences: [
          {
            apiVersion: "apps/v1",
            kind: "Deployment",
            name: deploymentName,
            uid: deploymentUid,
          },
        ],
      },
      spec: {
        selector: {
          app: deploymentName,
        },
        ports: [
          { protocol: "TCP", port: GAME_SERVER_PORT, targetPort: GAME_SERVER_PORT, name: "game" },
        ],
        type: "ClusterIP",
      },
    };

    await k8sApi.createNamespacedService({
      namespace: GAME_SERVER_NAMESPACE,
      body: service,
    });
    console.log(`[K8S] Kubernetes service created: ${serviceName}`);

    const ingressRouteCreated = await createIngressRoute(gameId, serviceName, deploymentUid);
    if (!ingressRouteCreated) {
      console.warn(`[K8S] Failed to create IngressRoute for ${gameId}, continuing anyway`);
    }

    const serverUrl = `wss://${GAME_SERVER_HOSTNAME}/game/${gameId}`;
    console.log(`[K8S] Game server URL: ${serverUrl}`);

    await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        serverUrl,
        status: "in_progress",
      },
    });

    console.log(`Game server created: ${deploymentName} at ${serverUrl}`);
    return { url: serverUrl, port: GAME_SERVER_PORT };

  } catch (error) {
    console.error("Failed to create game server:", error);
    return null;
  }
}

export async function destroyGameServer(gameId: string): Promise<boolean> {
  const deploymentName = `game-server-${gameId}`;
  const serviceName = `game-server-${gameId}`;

  try {
    console.log(`[K8S] Destroying game server ${gameId}`);

    console.log(`[K8S] Checking if deployment ${deploymentName} exists...`);
    try {
      await k8sAppsApi.readNamespacedDeployment({
        name: deploymentName,
        namespace: GAME_SERVER_NAMESPACE,
      });
      console.log(`[K8S] Deployment exists, proceeding with deletion`);
    } catch (readError: any) {
      console.log(`[K8S] Deployment not found or already deleted: ${readError.message}`);
      console.log(`[K8S] Proceeding to delete service/ingress anyway`);
    }

    console.log(`[K8S] Deleting deployment ${deploymentName}`);
    try {
      await k8sAppsApi.deleteNamespacedDeployment({
        name: deploymentName,
        namespace: GAME_SERVER_NAMESPACE,
      });
      console.log(`[K8S] Deployment deleted`);
    } catch (delError: any) {
      if (delError.statusCode === 404) {
        console.log(`[K8S] Deployment already deleted (404)`);
      } else {
        throw delError;
      }
    }

    console.log(`[K8S] Deleting service ${serviceName}`);
    try {
      await k8sApi.deleteNamespacedService({
        name: serviceName,
        namespace: GAME_SERVER_NAMESPACE,
      });
      console.log(`[K8S] Service deleted`);
    } catch (svcError: any) {
      if (svcError.statusCode === 404) {
        console.log(`[K8S] Service already deleted (404)`);
      } else {
        throw svcError;
      }
    }

    await deleteIngressRoute(gameId);

    console.log(`Game server destroyed: ${deploymentName}`);
    return true;

  } catch (error: any) {
    console.error(`[K8S] Failed to destroy game server ${gameId}:`, error.message);
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
