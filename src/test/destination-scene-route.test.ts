import { expect, it } from "vitest";
import { destinationSceneRoute } from "@/lib/destination-scene-route";
it("opens authored interiors directly and routes district arrivals to their actual streets", () => {
  expect(destinationSceneRoute({ slug: "community-clinic", type: "healthcare" })).toBeNull();
  expect(destinationSceneRoute({ slug: "student-district", type: "education" })).toBeNull();
  expect(destinationSceneRoute({ slug: "osun-mall", type: "commercial" })).toBeNull();
  expect(destinationSceneRoute({ slug: "city-centre", type: "residential" })).toEqual({
    to: "/neighborhood",
  });
  expect(destinationSceneRoute({ slug: "new-district", type: "district" })).toEqual({
    to: "/neighborhood",
  });
  expect(destinationSceneRoute({ slug: "cedar-bank", type: "bank" })).toEqual({
    to: "/bank/$slug",
    params: { slug: "cedar-bank" },
  });
});
