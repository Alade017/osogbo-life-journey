import { describe, expect, it } from "vitest";
import { parseFriendHouse } from "@/components/game/housing/friend-house";

const validHouse = {
  owner_name: "Ada",
  house: {
    id: "house-1",
    house_type_id: "duplex",
    walls_closed: null,
    house_type: {
      id: "duplex",
      label: "Duplex",
      slots: [{ id: "slot-1", slot_type: "seat", x: 10, y: 20 }, { bad: true }],
    },
  },
  placements: [
    {
      id: "p1",
      item_id: "sofa",
      slot: "free:1",
      x: 30,
      y: 40,
      floor: 1,
      art_key: "sofa",
      category: "furniture",
      slot_type: "seat",
    },
    { id: "broken" },
  ],
};

describe("parseFriendHouse", () => {
  it("reads a valid friend house and drops malformed rows", () => {
    const house = parseFriendHouse(validHouse);
    expect(house).toMatchObject({
      ownerName: "Ada",
      houseTypeId: "duplex",
      wallsClosed: null,
    });
    expect(house?.slots).toEqual([{ id: "slot-1", slot_type: "seat", x: 10, y: 20 }]);
    expect(house?.placements).toEqual([
      {
        id: "p1",
        item_id: "sofa",
        slot: "free:1",
        art_key: "sofa",
        category: "furniture",
        slot_type: "seat",
        x: 30,
        y: 40,
        floor: 1,
      },
    ]);
  });

  it("treats a response without a house as unavailable", () => {
    expect(parseFriendHouse(null)).toBeNull();
    expect(parseFriendHouse([])).toBeNull();
    expect(parseFriendHouse({ owner_name: "Ada", house: null })).toBeNull();
    expect(parseFriendHouse({ house: { walls_closed: true } })).toBeNull();
  });

  it("keeps walls as a boolean only when the server sends one", () => {
    const closed = parseFriendHouse({
      house: { house_type_id: "shared-room", walls_closed: true },
    });
    expect(closed?.wallsClosed).toBe(true);
    expect(closed?.ownerName).toBe("your friend");
  });
});
