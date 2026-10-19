import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Search, Clock, Zap, MapPin, Check, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { JOB_CATEGORIES, JOB_CATEGORY_LABELS, resolveJobCategory } from "@/lib/job-activity-model";
import { checkJobEligibility } from "@/lib/job-board-service";

export function PhoneJobsApp() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeShiftJobId, setActiveShiftJobId] = useState<string | null>(null);
  const [shiftProgress, setShiftProgress] = useState(0);

  const { data: character } = useQuery(q.character());
  const { data: jobs, isLoading } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: locations } = useQuery(q.locations());

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((job) => {
      const cat = resolveJobCategory(job.category);
      if (selectedCategory !== "all" && cat !== selectedCategory) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          job.title.toLowerCase().includes(query) ||
          job.employer?.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [jobs, selectedCategory, search]);

  const handleStartShift = (job: any) => {
    if ((character?.energy ?? 0) < (job.energy_required ?? 10)) {
      toast.error(`Not enough energy for this shift! Need at least ${job.energy_required ?? 10} Energy.`);
      return;
    }
    setActiveShiftJobId(job.id);
    setShiftProgress(10);
    toast.info(`Started shift as ${job.title} at ${job.employer ?? "Osogbo Works"}!`);

    const interval = setInterval(() => {
      setShiftProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setActiveShiftJobId(null);
          toast.success(`Shift completed! Earned ${formatNaira(job.salary_per_shift ?? job.salary_hourly * 4)}! 🎉`);
          return 0;
        }
        return prev + 30;
      });
    }, 1000);
  };

  return (
    <div className="phone-sub-app" role="region" aria-label="Jobs in Osogbo">
      <div className="phone-sub-header space-y-2 p-3 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Available Jobs: <strong className="text-foreground">{filteredJobs.length}</strong></span>
          <span>Energy: <strong className="text-foreground">{character?.energy ?? 100}</strong></span>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles, employers..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-background outline-none"
          />
        </div>

        {/* Categories scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hidden">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-bold flex-none transition-all ${
              selectedCategory === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
            }`}
          >
            All Roles
          </button>
          {JOB_CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex-none transition-all ${
                selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              }`}
            >
              {JOB_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="phone-sub-content p-3 space-y-3">
        {activeShiftJobId && (
          <div className="phone-card p-3 bg-primary/10 border-primary space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span>Shift in progress...</span>
              <span>{shiftProgress}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${shiftProgress}%` }}
              />
            </div>
          </div>
        )}

        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => {
            const isWorking = activeShiftJobId === job.id;
            const shiftPay = job.salary_per_shift ?? (job.salary_hourly ? job.salary_hourly * 4 : 2500);
            const locName = locations?.find((l) => l.id === job.location_id)?.name ?? "Osogbo Central";

            return (
              <div key={job.id} className="phone-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm">{job.title}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <BriefcaseBusiness className="h-3 w-3 text-primary flex-none" />
                      <span>{job.employer ?? "Local Business"}</span>
                      <span>·</span>
                      <MapPin className="h-3 w-3 text-muted-foreground flex-none" />
                      <span>{locName}</span>
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded flex-none">
                    {formatNaira(shiftPay)}/shift
                  </span>
                </div>

                {job.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span>Energy: -{job.energy_required ?? 10}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-500" />
                    <span>Duration: 4 hrs</span>
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isWorking || !!activeShiftJobId}
                  onClick={() => handleStartShift(job)}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 mt-1"
                >
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  {isWorking ? "Working Shift..." : "Work This Shift"}
                </button>
              </div>
            );
          })
        ) : (
          <div className="phone-empty-state">
            <BriefcaseBusiness className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-bold text-sm">No job openings found</p>
            <small className="text-xs text-muted-foreground">Try clearing your search query or filter.</small>
          </div>
        )}
      </div>
    </div>
  );
}
export default PhoneJobsApp;
