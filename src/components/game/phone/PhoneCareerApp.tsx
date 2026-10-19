import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, BookOpen, Award, Building, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";

const HUBS = [
  {
    name: "Osun Tech Hub",
    district: "Olaiya Junction",
    focus: "Digital skills, phone repair, software development",
    coursesOffered: ["Smartphone Diagnostics & Repair", "Digital Marketing & Brand Growth", "Fullstack Web Engineering"],
  },
  {
    name: "Aro Craft & Tailoring Guild",
    district: "Aro Area",
    focus: "Traditional Adire textiles, bespoke tailoring, pattern drafting",
    coursesOffered: ["Bespoke Native Tailoring", "Adire Dyeing Techniques"],
  },
  {
    name: "Osun State Polytechnic Extension",
    district: "Student District",
    focus: "Electrical installations, solar tech, auto mechanics",
    coursesOffered: ["Solar Inverter Setup & Maintenance", "Modern Automotive Diagnostics"],
  },
  {
    name: "Community Catering Institute",
    district: "Oke-Fia",
    focus: "Culinary arts, banquet catering, kitchen hygiene",
    coursesOffered: ["Professional Event Catering", "Baking & Pastry Mastery"],
  },
];

const LOCAL_COURSES = [
  {
    id: "phone-repair",
    name: "Smartphone Hardware & Repair",
    hub: "Osun Tech Hub",
    tuition: 3500,
    energyCost: 15,
    intelligenceGain: 8,
    careerGain: 12,
    duration: "2 sessions",
    unlocks: "Tech Repair Specialist",
  },
  {
    id: "adire-tailoring",
    name: "Adire Dyeing & Native Fashion",
    hub: "Aro Craft Guild",
    tuition: 2800,
    energyCost: 12,
    intelligenceGain: 5,
    careerGain: 15,
    duration: "3 sessions",
    unlocks: "Fashion Designer & Stall Owner",
  },
  {
    id: "solar-power",
    name: "Solar Inverter Installation",
    hub: "Polytechnic Extension",
    tuition: 5000,
    energyCost: 20,
    intelligenceGain: 12,
    careerGain: 18,
    duration: "4 sessions",
    unlocks: "Renewable Energy Technician",
  },
  {
    id: "commercial-catering",
    name: "Commercial Kitchen & Catering",
    hub: "Community Catering Institute",
    tuition: 2500,
    energyCost: 10,
    intelligenceGain: 6,
    careerGain: 10,
    duration: "2 sessions",
    unlocks: "Head Chef & Event Caterer",
  },
];

export function PhoneCareerApp() {
  const [tab, setTab] = useState<"courses" | "hubs" | "milestones">("courses");
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: courses } = useQuery(q.educationCourses());
  const [completedList, setCompletedList] = useState<string[]>([]);

  const completeAction = useGameAction(rpc.completeEducationCourse, {
    onSuccess: (result) => {
      setCompletedList((prev) => [...prev, result.course]);
      toast.success(`${result.course} finished! +${result.intelligence_gain} Intelligence, +${result.career_gain} Career.`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Enrollment error");
    },
  });

  const handleEnrollLocal = (course: (typeof LOCAL_COURSES)[number]) => {
    if ((wallet?.balance ?? 0) < course.tuition) {
      toast.error(`You need ${formatNaira(course.tuition)} to enroll in this course.`);
      return;
    }
    if ((character?.energy ?? 0) < course.energyCost) {
      toast.error(`Need at least ${course.energyCost} Energy to study this course. Rest first!`);
      return;
    }

    // If real server course exists, use completeAction
    const match = courses?.find((c) => c.name.toLowerCase().includes(course.name.toLowerCase().slice(0, 5)));
    if (match) {
      completeAction.mutate({ courseId: match.id, requestId: crypto.randomUUID() });
    } else {
      setCompletedList((prev) => [...prev, course.name]);
      toast.success(`${course.name} completed! Earned certification and skill boost.`);
    }
  };

  return (
    <div className="phone-sub-app" role="region" aria-label="Career Life and Education">
      <div className="phone-sub-header">
        <div className="phone-segmented-tabs">
          <button
            type="button"
            className={tab === "courses" ? "is-active" : ""}
            onClick={() => setTab("courses")}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Courses</span>
          </button>
          <button
            type="button"
            className={tab === "hubs" ? "is-active" : ""}
            onClick={() => setTab("hubs")}
          >
            <Building className="h-4 w-4" aria-hidden="true" />
            <span>Campuses</span>
          </button>
          <button
            type="button"
            className={tab === "milestones" ? "is-active" : ""}
            onClick={() => setTab("milestones")}
          >
            <Award className="h-4 w-4" aria-hidden="true" />
            <span>Milestones</span>
          </button>
        </div>
      </div>

      <div className="phone-sub-content">
        {tab === "courses" ? (
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
              <span>Energy: <strong className="text-foreground">{character?.energy ?? 100}</strong></span>
              <span>Balance: <strong className="text-foreground">{formatNaira(wallet?.balance)}</strong></span>
            </div>

            <div className="space-y-3">
              {LOCAL_COURSES.map((course) => {
                const isCompleted = completedList.includes(course.name);
                const canAfford = (wallet?.balance ?? 0) >= course.tuition;
                return (
                  <div key={course.id} className="phone-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm">{course.name}</h4>
                        <p className="text-xs text-muted-foreground">{course.hub}</p>
                      </div>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex-none">
                        {formatNaira(course.tuition)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] py-1 border-y border-border/40">
                      <span className="text-muted-foreground">Duration: {course.duration}</span>
                      <span className="text-muted-foreground">Energy Cost: {course.energyCost}</span>
                      <span className="text-emerald-600 font-semibold">+{course.intelligenceGain} Intelligence</span>
                      <span className="text-blue-600 font-semibold">+{course.careerGain} Career XP</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        Unlocks: <strong>{course.unlocks}</strong>
                      </span>
                      <button
                        type="button"
                        disabled={isCompleted || !canAfford || completeAction.isPending}
                        onClick={() => handleEnrollLocal(course)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                          isCompleted
                            ? "bg-emerald-600/20 text-emerald-600 cursor-default"
                            : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                        }`}
                      >
                        {isCompleted ? "Completed ✓" : "Enroll & Study"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === "hubs" ? (
          <div className="space-y-3 p-3">
            {HUBS.map((hub) => (
              <div key={hub.name} className="phone-card p-3 space-y-2">
                <div>
                  <h4 className="font-bold text-sm">{hub.name}</h4>
                  <p className="text-xs text-primary font-medium">{hub.district}</p>
                </div>
                <p className="text-xs text-muted-foreground">{hub.focus}</p>
                <div className="pt-2 border-t border-border/40">
                  <span className="text-[11px] font-bold block mb-1">Key Disciplines:</span>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                    {hub.coursesOffered.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 p-3">
            <div className="phone-card p-3 space-y-3">
              <h4 className="font-bold text-sm">Your Certifications</h4>
              {completedList.length > 0 ? (
                <div className="space-y-2">
                  {completedList.map((c) => (
                    <div key={c} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-bold">
                      <Check className="h-4 w-4" />
                      <span>{c} Certified</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No courses completed yet. Enroll in a training program to earn formal trade certifications and unlock promotions.
                </p>
              )}
            </div>

            <div className="phone-card p-3 space-y-2">
              <h4 className="font-bold text-sm">Career Ladder in Osogbo</h4>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded border border-border">
                  <div className="font-bold">Tier 1: Entry Worker</div>
                  <div className="text-muted-foreground">Market Porter, Flyer Distributor, Stall Helper</div>
                </div>
                <div className="p-2 rounded border border-border">
                  <div className="font-bold">Tier 2: Skilled Tradesperson</div>
                  <div className="text-muted-foreground">Phone Tech, Tailor, Caterer, Solar Installer</div>
                </div>
                <div className="p-2 rounded border border-border">
                  <div className="font-bold">Tier 3: Enterprise & Leadership</div>
                  <div className="text-muted-foreground">Store Owner, Event Organizer, Tech Lead</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default PhoneCareerApp;
