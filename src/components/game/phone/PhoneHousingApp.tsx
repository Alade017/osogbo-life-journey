import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { House, Building2, HelpCircle, Check, MapPin, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";
import { HOUSING, type HouseType } from "@/game/housing/eligibility";

const HOUSING_LIST: Array<{
  id: string;
  name: string;
  district: string;
  bedrooms: number;
  sharedFacilities: boolean;
  weeklyRent: number;
  deposit: number;
  upfrontTotal: number;
  description: string;
}> = [
  {
    id: "single-room-oke-fia",
    name: "Oke-Fia Starter Room",
    district: "Oke-Fia",
    bedrooms: 1,
    sharedFacilities: true,
    weeklyRent: 1500,
    deposit: 3000,
    upfrontTotal: 4500,
    description: "Compact single room with electricity and borehole water. Ideal for students and entry workers.",
  },
  {
    id: "self-contain-stadium",
    name: "Stadium Rd Self-Contained",
    district: "Stadium Area",
    bedrooms: 1,
    sharedFacilities: false,
    weeklyRent: 3500,
    deposit: 7000,
    upfrontTotal: 10500,
    description: "Private ensuite bathroom, tiled floors, personal kitchen corner near Osogbo Stadium.",
  },
  {
    id: "two-bedroom-aregbe",
    name: "Aregbe 2-Bedroom Flat",
    district: "Aregbe",
    bedrooms: 2,
    sharedFacilities: false,
    weeklyRent: 7500,
    deposit: 15000,
    upfrontTotal: 22500,
    description: "Spacious family flat with prepaid meter, secured compound gate, and parking space.",
  },
  {
    id: "grove-terrace",
    name: "Osun Grove Terrace",
    district: "Grove Vista",
    bedrooms: 3,
    sharedFacilities: false,
    weeklyRent: 14000,
    deposit: 28000,
    upfrontTotal: 42000,
    description: "Tranquil three-bedroom home close to cultural forest paths and scenic gardens.",
  },
  {
    id: "gra-executive-villa",
    name: "GRA Executive Villa",
    district: "Osogbo GRA",
    bedrooms: 4,
    sharedFacilities: false,
    weeklyRent: 28000,
    deposit: 56000,
    upfrontTotal: 84000,
    description: "Executive detached home with generator backup, garden, security post and luxury finishing.",
  },
];

export function PhoneHousingApp() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"browse" | "quiz" | "mine">("browse");
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());

  // Quiz states
  const [quizHousehold, setQuizHousehold] = useState<"alone" | "partner" | "family">("alone");
  const [quizSpace, setQuizSpace] = useState<"starter" | "moderate" | "luxury">("starter");
  const [quizPriority, setQuizPriority] = useState<"budget" | "privacy" | "comfort">("budget");

  const recommendedHouse = useMemo(() => {
    if (quizPriority === "budget" || quizSpace === "starter") return HOUSING_LIST[0];
    if (quizHousehold === "alone" || quizPriority === "privacy") return HOUSING_LIST[1];
    if (quizHousehold === "family" && quizSpace === "luxury") return HOUSING_LIST[4];
    if (quizHousehold === "family") return HOUSING_LIST[2];
    return HOUSING_LIST[3];
  }, [quizHousehold, quizSpace, quizPriority]);

  // Rent tenancy mutation
  const rentMutation = useMutation({
    mutationFn: async (house: (typeof HOUSING_LIST)[number]) => {
      if (!wallet || wallet.balance < house.upfrontTotal) {
        throw new Error(`Insufficient funds. You need ${formatNaira(house.upfrontTotal)} to rent this home.`);
      }
      toast.success(`Lease approved for ${house.name}! Keys collected.`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to rent house");
    },
  });

  return (
    <div className="phone-sub-app" role="region" aria-label="Housing and Property">
      <div className="phone-sub-header">
        <div className="phone-segmented-tabs">
          <button
            type="button"
            className={tab === "browse" ? "is-active" : ""}
            onClick={() => setTab("browse")}
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span>Find Homes</span>
          </button>
          <button
            type="button"
            className={tab === "quiz" ? "is-active" : ""}
            onClick={() => setTab("quiz")}
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>Match Quiz</span>
          </button>
          <button
            type="button"
            className={tab === "mine" ? "is-active" : ""}
            onClick={() => setTab("mine")}
          >
            <House className="h-4 w-4" aria-hidden="true" />
            <span>My Home</span>
          </button>
        </div>
      </div>

      <div className="phone-sub-content">
        {tab === "browse" ? (
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
              <span>Available rentals across Osogbo</span>
              <span>Balance: <strong className="text-foreground">{formatNaira(wallet?.balance)}</strong></span>
            </div>

            {HOUSING_LIST.map((house) => {
              const canAfford = (wallet?.balance ?? 0) >= house.upfrontTotal;
              return (
                <div key={house.id} className="phone-card p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm">{house.name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-primary" />
                        {house.district} · {house.bedrooms} {house.bedrooms === 1 ? "Bed" : "Beds"}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {formatNaira(house.weeklyRent)}/wk
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">{house.description}</p>

                  <div className="grid grid-cols-2 gap-1.5 py-1.5 border-y border-border/40 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">Deposit: </span>
                      <strong>{formatNaira(house.deposit)}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Upfront Total: </span>
                      <strong>{formatNaira(house.upfrontTotal)}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Facilities: </span>
                      <span>{house.sharedFacilities ? "Shared compound bath/toilet" : "Private ensuite facilities"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAfford || rentMutation.isPending}
                    onClick={() => rentMutation.mutate(house)}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {canAfford ? "Rent This Home" : "Requires " + formatNaira(house.upfrontTotal)}
                  </button>
                </div>
              );
            })}
          </div>
        ) : tab === "quiz" ? (
          <div className="space-y-4 p-3">
            <div className="phone-card p-3 space-y-3">
              <div className="border-b border-border/40 pb-2">
                <h4 className="font-bold text-sm">Smart Housing Match</h4>
                <p className="text-xs text-muted-foreground">Answer 3 questions to find your ideal home in Osogbo</p>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1.5">1. Who will live with you?</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "alone", label: "Just Me" },
                    { id: "partner", label: "Partner" },
                    { id: "family", label: "Family" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setQuizHousehold(opt.id as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                        quizHousehold === opt.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1.5">2. How much space do you desire?</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "starter", label: "Single Room" },
                    { id: "moderate", label: "Self-Contain" },
                    { id: "luxury", label: "Full Flat" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setQuizSpace(opt.id as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                        quizSpace === opt.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1.5">3. What matters most to you?</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "budget", label: "Lowest Rent" },
                    { id: "privacy", label: "Private Bath" },
                    { id: "comfort", label: "Prime Area" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setQuizPriority(opt.id as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                        quizPriority === opt.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Result */}
            {recommendedHouse && (
              <div className="phone-card p-3 border-2 border-primary/40 bg-primary/5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Check className="h-4 w-4" /> Recommended Match for You
                </div>
                <h4 className="font-bold text-base">{recommendedHouse.name}</h4>
                <p className="text-xs text-muted-foreground">{recommendedHouse.description}</p>
                <div className="flex items-center justify-between text-xs pt-1 font-semibold">
                  <span>Weekly: {formatNaira(recommendedHouse.weeklyRent)}</span>
                  <span>Upfront: {formatNaira(recommendedHouse.upfrontTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTab("browse");
                    rentMutation.mutate(recommendedHouse);
                  }}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 mt-1"
                >
                  Proceed with this Home
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 p-3">
            <div className="phone-card p-3 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <House className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-bold text-sm">Starter Residence</h4>
                  <p className="text-xs text-muted-foreground">Oke-Fia District, Osogbo</p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-accent/20 border border-border/40 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenancy Status:</span>
                  <span className="font-bold text-emerald-600">Active Tenant</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weekly Rent:</span>
                  <span className="font-bold">₦1,500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days till next cycle:</span>
                  <span className="font-bold">4 days</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast.success("Advance rent of ₦1,500 paid for next week.")}
                className="w-full py-2 rounded-lg text-xs font-bold bg-card border border-border hover:bg-accent text-foreground"
              >
                Pay Advance Rent (₦1,500)
              </button>
            </div>

            {/* Emergency Rent Relief Notice */}
            <div className="phone-card p-3 border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <AlertTriangle className="h-4 w-4" /> Osogbo Rent Relief Program
              </div>
              <p className="text-xs text-muted-foreground">
                If your character energy or wallet balance drops critically low, you can apply for community tenancy relief to prevent eviction.
              </p>
              <button
                type="button"
                onClick={() => toast.info("Your account is currently in good standing. Relief is available when rent is overdue.")}
                className="text-xs font-bold text-amber-600 underline block"
              >
                Check Relief Eligibility
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default PhoneHousingApp;
