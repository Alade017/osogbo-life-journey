/** Static, decorative town scenery. No WebGL or image download on the entry screen. */
export function LandingBackdrop() {
  return (
    <div className="cin-backdrop" aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="landing-sky" x2="0" y2="1">
            <stop stopColor="var(--cin-sky)" />
            <stop offset="1" stopColor="var(--cin-horizon)" />
          </linearGradient>
          <linearGradient id="landing-land" x2="0" y2="1">
            <stop stopColor="var(--cin-hill)" />
            <stop offset="1" stopColor="var(--cin-deep)" />
          </linearGradient>
          <pattern id="landing-windows" width="32" height="38" patternUnits="userSpaceOnUse">
            <rect x="12" y="12" width="8" height="13" rx="2" fill="var(--cin-window)" />
          </pattern>
          <g id="landing-palm">
            <path d="M0 0 Q12-85 2-164" fill="none" stroke="var(--cin-tree)" strokeWidth="11" />
            <path
              d="M2-160 Q-47-215-75-166 Q-29-181 2-160 Q-13-222 26-216 Q10-188 2-160 Q55-219 88-176 Q43-184 2-160 Q63-172 65-133 Q35-156 2-160 Q-45-168-55-131 Q-20-153 2-160"
              fill="var(--cin-tree)"
            />
          </g>
        </defs>
        <path fill="url(#landing-sky)" d="M0 0h1600v1000H0z" />
        <circle cx="1240" cy="275" r="145" fill="var(--cin-sun)" opacity=".14" />
        <circle cx="1240" cy="275" r="96" fill="var(--cin-sun)" opacity=".2" />
        <circle cx="1240" cy="275" r="60" fill="var(--cin-sun)" />
        <path
          d="M0 460 Q240 320 500 440 T970 410 T1600 390 V1000H0Z"
          fill="var(--cin-hill)"
          opacity=".4"
        />
        <g fill="var(--cin-distant)">
          <path d="M40 550V440h96v110m38 0V397h74v153m33 0V458h112v92m25 0V420h90v130m30 0V470h83v80m30 0V405h112v145m33 0V450h84v100m30 0V370h80v180m36 0V432h120v118m30 0V395h90v155m35 0V455h110v95m30 0V420h110v130m35 0V385h130v165" />
        </g>
        <path d="M0 565 Q480 505 850 560 T1600 535 V1000H0Z" fill="url(#landing-land)" />
        <path d="M790 1000 1050 570h64l230 430" fill="var(--cin-road)" />
        <path
          d="m1090 610 1 32m-3 37-3 45m-4 46-5 63m-7 65-9 90"
          fill="none"
          stroke="var(--cin-window)"
          strokeWidth="4"
          opacity=".4"
        />
        <g fill="var(--cin-wall)">
          <path d="M620 560h190v160H620zM840 485h133v128H840zM1150 525h190v180h-190zM1380 470h180v143h-180z" />
        </g>
        <g fill="url(#landing-windows)" opacity=".75">
          <path d="M630 580h170v100H630zM850 505h113v80H850zM1160 550h170v110h-170zM1390 490h160v96h-160z" />
        </g>
        <g fill="var(--cin-roof)">
          <path d="m602 562 112-66 115 66zM823 489l83-54 85 54zM1133 530l111-67 115 67zM1363 473l106-62 110 62z" />
        </g>
        <g fill="var(--cin-tree)">
          <path d="M0 770q120-145 260-25 100-100 220 20v235H0zm1280 230q40-220 170-206 80-110 150-80v286z" />
        </g>
        <use href="#landing-palm" transform="translate(555 690) scale(1.25)" />
        <use href="#landing-palm" transform="translate(1380 710) scale(1.65)" />
        <use href="#landing-palm" transform="translate(1500 575) scale(.8)" />
      </svg>
    </div>
  );
}
