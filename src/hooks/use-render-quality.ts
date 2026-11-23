import { useEffect, useState } from "react";
import { selectWorldRenderQuality, type WorldRenderQuality } from "@/components/3d/render-quality";

type DeviceNavigator = Navigator & {
  deviceMemory?: number;
};

export function useRenderQuality() {
  const [quality, setQuality] = useState<WorldRenderQuality>("standard");

  useEffect(() => {
    const device = navigator as DeviceNavigator;
    setQuality(
      selectWorldRenderQuality({
        memoryGB: device.deviceMemory,
        logicalCores: device.hardwareConcurrency,
      }),
    );
  }, []);

  return quality;
}
