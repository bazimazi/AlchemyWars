const paths = {
  flame: '<path d="M13 3c2 5-3 6-1 10 1-2 3-3 4-5 5 6 4 12-3 13-7 0-10-7-6-12 0 3 1 4 2 4-1-4 4-6 4-10Z"/>',
  drop: '<path d="M12 2C10 6 4 11 4 15a8 8 0 0 0 16 0c0-4-6-9-8-13Z"/><path d="M8 15c0 3 2 4 4 4"/>',
  mountain: '<path d="m2 20 8-15 4 7 3-5 5 13H2Z"/><path d="m7 11 3 2 3-2M13 20l4-7 3 7"/>',
  wind: '<path d="M3 8h12c5 0 5-6 1-6-2 0-3 1-3 3M2 12h17c4 0 4 6 0 6-2 0-3-1-3-3M4 16h6c4 0 4 6 0 6"/>',
  bolt: '<path d="m14 2-10 12h7l-1 8L21 9h-8l1-7Z"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-1-1-4M18 18l-1-4 4-1M3 13l4 1-1 4M18 6l-1 4 4 1"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 16c8 6 15 0 15-13Z"/><path d="m3 22 13-15M8 16v-6m0 6h6"/>',
  venom: '<path d="M9 3h6M10 3v6l-6 9c-1 2 0 3 2 3h12c2 0 3-1 2-3l-6-9V3M7 14h10"/><circle cx="10" cy="17" r=".6"/><circle cx="14" cy="18" r=".6"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/><path d="m18 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>',
  cloud: '<path d="M7 17a5 5 0 1 1-1-10 6 6 0 0 1 11-1 5 5 0 1 1 1 11H7Z"/><path d="m8 20-1 2m6-2-1 2m6-2-1 2"/>',
  shield: '<path d="m12 2 9 4v7c-1 5-5 8-9 10-4-2-8-5-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  burst: '<path d="m12 1 2 7 6-4-4 6 7 2-7 2 4 6-6-4-2 7-2-7-6 4 4-6-7-2 7-2-4-6 6 4Z"/>',
  lab: '<path d="M8 2h8M10 2v7L3 20c-.5 1 0 2 2 2h14c2 0 2.5-1 2-2L14 9V2M7 15h10"/><circle cx="10" cy="18" r=".5"/><circle cx="14" cy="17" r=".5"/>',
  home: '<path d="m3 10 9-8 9 8v11H3V10Z"/><path d="M9 21v-8h6v8"/>',
  swords: '<path d="m3 2 8 5 10 14m-1-19-8 5L2 21M3 2l1 8 10 8M20 2l-1 8-9 8M2 15l7 6m6-1 6-5"/>',
  book: '<path d="M12 5C7 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-5-2-10 1v16"/><path d="M5 8h4m-4 4h4m6-4h4m-4 4h4"/>',
  team: '<circle cx="12" cy="7" r="4"/><path d="M5 22v-4a7 7 0 0 1 14 0v4M3 8a3 3 0 0 0 0 6m18-6a3 3 0 0 1 0 6M1 22v-3c0-2 1-3 3-3m19 6v-3c0-2-1-3-3-3"/>',
  research: '<path d="M9 21h6m-6-4h6v-3a7 7 0 1 0-6 0v3Zm3 0V9m-3 0 3 3 3-3"/>',
  settings: '<path d="m9 2-1 3-3 1-2 3 2 3-2 3 2 3 3 1 1 3h6l1-3 3-1 2-3-2-3 2-3-2-3-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M3 12h18m-7-7 7 7-7 7"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 6 4 6-4 6-4-6 4-6Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  graph: '<circle cx="12" cy="4" r="3"/><circle cx="4" cy="19" r="3"/><circle cx="20" cy="19" r="3"/><path d="m10 7-5 9m9-9 5 9M7 19h10"/>',
};

export function icon(name, className = '') {
  return '<svg class="icon ' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.burst) + '</svg>';
}

export function sigil() {
  return '<svg viewBox="0 0 400 400" class="sigil" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="200" cy="200" r="174"/><circle cx="200" cy="200" r="164" stroke-dasharray="2 12"/><circle cx="200" cy="200" r="132"/><path d="m200 30 147 255H53Zm0 340L53 115h294Z"/><circle cx="200" cy="200" r="78"/><path d="M20 200h360M200 20v360" opacity=".5"/><circle cx="200" cy="26" r="5"/><circle cx="200" cy="374" r="5"/><circle cx="26" cy="200" r="5"/><circle cx="374" cy="200" r="5"/></g></svg>';
}

export function creature(shape, color, className = '') {
  const bodies = {
    golem: '<path d="m27 38 11-21 24-3 15 26-5 26-10 11H37L25 60Z" fill="currentColor"/><path d="m25 38-13 8-4 22 15 4 9-15m44-19 13 8 4 22-15 4-9-15M36 73l-7 19h18l4-17m13-2 7 19H54l-3-17" fill="currentColor" opacity=".65"/><path d="m38 22 5 13-6 14 7 15m16-44-5 18 10 14-9 18M32 49h38" stroke="#17251e" opacity=".5"/>',
    sprite: '<path d="M49 9c17 24-12 25 3 40 9-3 12-13 10-22 31 29 20 56-10 59C19 86 9 60 28 38c-1 14 4 15 8 17-4-22 17-25 13-46Z" fill="currentColor"/><path d="M49 39c8 12-8 21 0 30 5-2 9-7 8-13 13 15 4 24-9 24-16-1-19-13-11-23 1 6 3 8 6 8-4-10 9-18 6-26Z" fill="#ffe7b5" opacity=".55"/>',
    sylph: '<path d="M50 10C38 26 21 40 21 58c0 23 18 28 29 28s29-5 29-28c0-18-17-32-29-48Z" fill="currentColor"/><path d="M16 74c18-9 49 17 69-4M12 84c19-9 54 13 74-3" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/><path d="M43 29c-8 11-13 19-13 29" fill="none" stroke="#e2fcf5" stroke-width="5" opacity=".5"/>',
    keeper: '<path d="M44 46C11 41 16 14 16 14s31 3 34 27C50 9 78 7 78 7S88 37 58 48Z" fill="currentColor"/><path d="M35 47h30l10 34-25 10-25-10Z" fill="currentColor" opacity=".8"/><path d="m32 64-17 11m51-11 17 11M42 86l-8 9m23-9 8 9M49 47V29" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    wraith: '<path d="M50 14c21 0 30 19 24 35-4 15 8 29 13 36-15 4-22-4-24-9-5 16-13 20-13 20s-8-4-13-20c-2 5-9 13-24 9 5-7 17-21 13-36-6-16 3-35 24-35Z" fill="currentColor"/><path d="M39 19c-4 21-4 42 2 57" fill="none" stroke="white" opacity=".15" stroke-width="4"/>',
    slime: '<path d="M13 75c0-15 4-24 10-27 2-26 34-32 45-10 16 1 20 14 20 25 7 21-9 25-37 25S13 84 13 75Z" fill="currentColor"/><path d="M26 48c3-12 11-17 19-15" fill="none" stroke="white" opacity=".3" stroke-width="5" stroke-linecap="round"/>',
    king: '<path d="m23 30 5-20 13 12L50 6l9 16 13-12 5 20-9 14H32Z" fill="#eac687"/><path d="m29 37-7 34 14 18h28l14-18-7-34Z" fill="currentColor"/><path d="m25 44-13 8-6 27 18 3m52-38 13 8 6 27-18 3" fill="currentColor" opacity=".75"/><path d="m50 41-8 20 11 3-6 20 17-24-11-3 9-16Z" fill="#ffdb8b"/>',
  };
  return '<svg class="creature ' + className + '" viewBox="0 0 100 105" style="color:' + color + '" aria-hidden="true"><ellipse cx="50" cy="95" rx="32" ry="6" fill="black" opacity=".2"/>' + (bodies[shape] ?? bodies.sprite) + '<g fill="#182822"><path d="M35 51h10v7H35zm20 0h10v7H55z"/><path d="M44 65q6 4 12 0" fill="none" stroke="#182822" stroke-width="2"/></g></svg>';
}

export function landscape() {
  return '<svg viewBox="0 0 900 270" preserveAspectRatio="xMidYMax slice" class="landscape" aria-hidden="true"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#172c2a"/><stop offset="1" stop-color="#304d3d"/></linearGradient></defs><rect width="900" height="270" fill="url(#sky)"/><circle cx="660" cy="75" r="37" fill="#c5c5a0" opacity=".45"/><path d="M0 170 70 100l80 65 110-95 110 103 92-63 117 70 120-45 201 50v100H0Z" fill="#284035"/><path d="m0 220 100-52 76 35 126-51 132 72 157-42 142 28 167-70v160H0Z" fill="#20382c"/><g fill="#152a22"><path d="m120 45-53 151h30l-38 52h129l-40-52h29Zm620-22-60 183h29l-30 48h124l-30-48h27Z"/><path d="M118 171h7v99h-7m619-23h8V166h-8"/><path d="M370 186v-63l30-20 28 20v63h-11v-51h-34v51m-7-66 24-50 23 50Z"/></g><g fill="#ddcf95" opacity=".65"><circle cx="260" cy="193" r="2"/><circle cx="527" cy="206" r="2"/><circle cx="461" cy="144" r="1.5"/><circle cx="326" cy="221" r="1.5"/><circle cx="604" cy="184" r="2"/></g></svg>';
}
