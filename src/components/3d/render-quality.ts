export const WORLD_RENDER_QUALITY = {
  standard: {
    maxDpr: 1.5,
    shadowMapSize: 2048,
    contactShadows: true,
    postProcessing: true,
  },
  performance: {
    maxDpr: 1,
    shadowMapSize: 1024,
    contactShadows: false,
    postProcessing: false,
  },
} as const;

export type WorldRenderQuality = keyof typeof WORLD_RENDER_QUALITY;

export interface RenderDeviceCapabilities {
  memoryGB?: number | undefined;
  logicalCores?: number | undefined;
}

export function selectWorldRenderQuality({
  memoryGB,
  logicalCores,
}: RenderDeviceCapabilities): WorldRenderQuality {
  const limitedMemory = memoryGB !== undefined && memoryGB > 0 && memoryGB <= 4;
  const limitedCores = logicalCores !== undefined && logicalCores > 0 && logicalCores <= 4;

  return limitedMemory || limitedCores ? "performance" : "standard";
}
