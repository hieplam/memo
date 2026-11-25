// Builds the Christmas night scene as one animated SVG string.

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = rng(2026)
const n = (v: number): string => (Math.round(v * 10) / 10).toString()
const between = (a: number, b: number): number => a + rand() * (b - a)

// sky

function stars(): string {
  let out = ''
  for (let i = 0; i < 110; i++) {
    const x = between(0, 1600)
    const y = between(0, 640)
    const r = between(0.6, 1.9)
    out += `<circle class="tw${(i % 3) + 1}" style="animation-delay:-${n(between(0, 6))}s" cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/>`
  }
  return out
}

function sparkle(x: number, y: number, s: number): string {
  const k = s * 0.16
  return `<path class="spark" style="animation-delay:-${n(between(0, 6))}s" d="M${n(x)} ${n(y - s)}L${n(x + k)} ${n(y - k)}L${n(x + s)} ${n(y)}L${n(x + k)} ${n(y + k)}L${n(x)} ${n(y + s)}L${n(x - k)} ${n(y + k)}L${n(x - s)} ${n(y)}L${n(x - k)} ${n(y - k)}Z"/>`
}

// forest

function pine(x: number, y: number, h: number, w: number): string {
  const p: Array<[number, number]> = [
    [0, -h], [0.25, -0.62], [0.12, -0.62], [0.38, -0.3], [0.22, -0.3], [0.5, 0],
    [-0.5, 0], [-0.22, -0.3], [-0.38, -0.3], [-0.12, -0.62], [-0.25, -0.62],
  ]
  return p
    .map(([dx, dy], i) => {
      const px = i === 0 ? x : x + dx * w
      const py = i === 0 ? y - h : y + dy * h
      return `${i === 0 ? 'M' : 'L'}${n(px)} ${n(py)}`
    })
    .join('') + 'Z'
}

function forest(base: number, minH: number, maxH: number, step: number): string {
  let d = ''
  for (let x = -20; x < 1640; x += step * between(0.7, 1.2)) {
    const h = between(minH, maxH)
    d += pine(x, base + between(-6, 6), h, h * 0.5)
  }
  return d
}

// the flying team, heading left

function flyer(x: number, y: number): string {
  return (
    `<ellipse cx="${x}" cy="${y}" rx="20" ry="6.5"/>` +
    `<path d="M${x - 14} ${y + 2}L${x - 32} ${y + 9}M${x - 12} ${y + 3}L${x - 28} ${y + 12}M${x + 14} ${y + 2}L${x + 32} ${y + 5}M${x + 12} ${y + 3}L${x + 30} ${y + 9}M${x - 16} ${y - 2}L${x - 26} ${y - 12}M${x - 30} ${y - 22}L${x - 26} ${y - 13}L${x - 18} ${y - 21}M${x - 27} ${y - 17}L${x - 33} ${y - 19}M${x + 19} ${y - 2}L${x + 25} ${y - 7}" class="legs"/>` +
    `<ellipse cx="${x - 30}" cy="${y - 13}" rx="6" ry="3.5"/>`
  )
}

function team(): string {
  const deer: Array<[number, number]> = [
    [1095, 236],
    [1165, 244],
    [1235, 252],
    [1302, 258],
  ]
  let out = '<g class="team">'
  for (const [x, y] of deer) out += flyer(x, y)
  out += `<path class="rein" d="M1080 224Q1240 236 1400 228"/>`
  // sleigh, santa and the sack
  out +=
    `<path d="M1400 232Q1404 252 1430 252H1505Q1525 252 1532 232L1540 222Q1528 226 1520 222V206H1440Q1432 228 1400 232Z"/>` +
    `<path class="legs" d="M1392 262H1530Q1548 262 1550 248M1420 252V262M1500 252V262"/>` +
    `<circle cx="1492" cy="188" r="18"/><circle cx="1490" cy="166" r="9"/><path d="M1482 160Q1490 140 1504 152L1498 160Z"/>` +
    `<ellipse cx="1455" cy="196" rx="20" ry="16"/>`
  out += '</g>'
  return out
}

// cabin

function cabin(): string {
  let logs = ''
  for (let y = 729; y < 850; y += 14) logs += `M35 ${y}H305`
  let icicles = ''
  for (let x = 32; x < 318; x += 9) {
    const len = between(6, 14)
    icicles += `M${n(x)} 741L${n(x + 3)} ${n(741 + len)}L${n(x + 6)} 741Z`
  }
  return `
<g class="cabin">
  <ellipse cx="170" cy="852" rx="190" ry="16" fill="#e8eef9"/>
  <circle class="winglow" cx="140" cy="768" r="70" fill="url(#warm)"/>
  <circle class="winglow" cx="270" cy="768" r="70" fill="url(#warm)" style="animation-delay:-2.3s"/>
  <rect x="35" y="715" width="270" height="137" fill="#6b4126"/>
  <path d="${logs}" stroke="#432512" stroke-width="2"/>
  <path d="M35 715L170 632L305 715Z" fill="#5a3520"/>
  <path d="M60 715L170 646L280 715" stroke="#432512" stroke-width="2" fill="none"/>
  <circle cx="205" cy="684" r="14" fill="#ffcf6b"/>
  <path d="M191 684H219M205 670V698" stroke="#5a3520" stroke-width="2.5"/>
  <rect x="140" y="588" width="30" height="58" fill="#7d8291"/>
  <rect x="136" y="582" width="38" height="10" rx="4" fill="#f4f7fd"/>
  <path d="M8 732L170 614L338 732L324 744L170 634L22 744Z" fill="#f4f7fd"/>
  <path d="M22 744L170 634L324 744L318 748L170 640L28 748Z" fill="#b9c6e2"/>
  <path d="${icicles}" fill="#e6eefc"/>
  <rect x="108" y="748" width="54" height="52" fill="#ffc865"/>
  <rect x="238" y="748" width="54" height="52" fill="#ffc865"/>
  <path d="M135 748V800M108 774H162M265 748V800M238 774H292" stroke="#6b4126" stroke-width="3"/>
  <path d="M104 744H166V804H104ZM234 744H296V804H234Z" stroke="#4a2a17" stroke-width="4" fill="none"/>
  <path d="M100 806H170M230 806H300" stroke="#f4f7fd" stroke-width="5" stroke-linecap="round"/>
  <rect x="183" y="762" width="44" height="90" fill="#4a2816"/>
  <path d="M187 766H223V848H187Z" stroke="#3a1f10" stroke-width="2" fill="none"/>
  <circle cx="205" cy="790" r="10" fill="none" stroke="#2f7a3e" stroke-width="5"/>
  <circle cx="198" cy="784" r="2" fill="#e0303f"/><circle cx="212" cy="786" r="2" fill="#e0303f"/><circle cx="205" cy="799" r="2.5" fill="#e0303f"/>
  <rect x="232" y="768" width="8" height="13" rx="2" fill="#ffd27a" class="winglow"/>
  <circle class="smoke" cx="155" cy="572" r="9"/>
  <circle class="smoke" cx="155" cy="572" r="9" style="animation-delay:-3s"/>
  <circle class="smoke" cx="155" cy="572" r="9" style="animation-delay:-6s"/>
</g>`
}

// standing reindeer

function deer(): string {
  return `
<g class="deer">
  <ellipse cx="450" cy="874" rx="90" ry="9" fill="#6d80b3" opacity=".55"/>
  <path d="M400 812L396 872M416 816L414 870M470 816L474 870M486 812L490 872" stroke="#4e321f" stroke-width="8" stroke-linecap="round"/>
  <ellipse cx="444" cy="800" rx="58" ry="26" fill="#6e4a2e"/>
  <path d="M388 790Q380 782 384 776" stroke="#6e4a2e" stroke-width="7" stroke-linecap="round"/>
  <path d="M478 800Q490 770 500 748L516 754Q504 786 498 810Z" fill="#6e4a2e"/>
  <ellipse cx="494" cy="800" rx="11" ry="17" fill="#ece5d8"/>
  <g class="head">
    <path d="M498 740Q520 734 536 752Q534 760 524 760Q510 760 500 754Z" fill="#6e4a2e"/>
    <circle cx="534" cy="754" r="3" fill="#2a1a10"/>
    <circle cx="514" cy="745" r="2" fill="#1a0f08"/>
    <path d="M500 742L490 734L496 746Z" fill="#5a3a22"/>
    <path d="M504 738Q496 714 478 700M494 720L480 716M488 710L494 696M506 738Q514 712 532 700M520 714L534 714M526 706L522 692" stroke="#9a7a55" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>
</g>`
}

// tree

const CX = 1385

function tree(): string {
  const tiers: Array<[number, number, number]> = [
    [438, 545, 62],
    [478, 615, 100],
    [530, 690, 138],
    [592, 768, 176],
    [660, 862, 214],
  ]
  let body = ''
  let shade = ''
  let snow = ''
  for (let i = tiers.length - 1; i >= 0; i--) {
    const [top, bot, w] = tiers[i] as [number, number, number]
    body += `<path d="M${CX} ${top}L${CX + w} ${bot}Q${CX + w * 0.5} ${bot - 16} ${CX} ${bot - 4}Q${CX - w * 0.5} ${bot - 16} ${CX - w} ${bot}Z" fill="#1f5a35"/>`
    shade += `<path d="M${CX} ${top}L${CX + w} ${bot}Q${CX + w * 0.5} ${bot - 16} ${CX} ${bot - 4}Z" fill="#123d23" opacity=".55"/>`
    snow += `<path d="M${CX - w} ${bot}Q${CX - w * 0.6} ${bot - 10} ${CX - w * 0.35} ${bot - 12}M${CX + w * 0.4} ${bot - 12}Q${CX + w * 0.7} ${bot - 10} ${CX + w} ${bot}" stroke="#eef3fc" stroke-width="5" stroke-linecap="round" fill="none"/>`
  }

  // garlands of small lights
  let lights = ''
  const rows: Array<[number, number]> = [
    [520, 52],
    [585, 84],
    [655, 118],
    [728, 152],
    [808, 190],
  ]
  for (const [y, w] of rows) {
    const steps = Math.round(w / 9)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const x = CX - w + 2 * w * t
      const yy = y + Math.sin(t * Math.PI) * 18 - t * 26
      lights += `<circle class="l${(s % 3) + 1}" cx="${n(x)}" cy="${n(yy)}" r="3.4"/>`
    }
  }

  // baubles
  let baubles = ''
  const colors = ['#e0283c', '#f2c14e', '#3d86e0', '#d9dde6', '#e0283c', '#f2c14e']
  for (let i = 0; i < 34; i++) {
    const y = between(490, 850)
    const half = ((y - 440) / 425) * 205 * 0.82
    const x = CX + (rand() * 2 - 1) * half
    const r = between(5, 8)
    baubles += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${colors[i % colors.length]}"/><circle cx="${n(x - r * 0.35)}" cy="${n(y - r * 0.35)}" r="${n(r * 0.3)}" fill="#fff" opacity=".7"/>`
  }

  // star
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 === 0 ? 26 : 11
    pts.push(`${n(CX + Math.cos(a) * r)} ${n(432 + Math.sin(a) * r)}`)
  }

  return `
<g class="tree">
  <ellipse cx="${CX}" cy="905" rx="215" ry="20" fill="#7186bb" opacity=".5"/>
  <rect x="${CX - 15}" y="852" width="30" height="40" fill="#4a2c1a"/>
  ${body}${shade}${snow}
  <g class="lights">${lights}</g>
  ${baubles}
  <circle class="starglow" cx="${CX}" cy="432" r="90" fill="url(#starGlow)"/>
  <path class="rays" d="M${CX} 352V512M${CX - 80} 432H${CX + 80}" stroke="#fff5c9" stroke-width="1.5" opacity=".7"/>
  <path class="topstar" d="M${pts.join('L')}Z" fill="#ffd84a" stroke="#fff3b8" stroke-width="1.5"/>
  <g class="gifts">
    <rect x="1215" y="845" width="90" height="62" fill="#c8202f"/><rect x="1260" y="845" width="45" height="62" fill="#000" opacity=".12"/>
    <path d="M1260 845V907M1215 868H1305" stroke="#f2c14e" stroke-width="7"/>
    <path d="M1260 845Q1238 822 1244 840ZM1260 845Q1282 822 1276 840Z" stroke="#f2c14e" stroke-width="5" fill="none"/>
    <rect x="1298" y="872" width="66" height="45" fill="#eef2fa"/>
    <path d="M1331 872V917M1298 890H1364" stroke="#3d72d0" stroke-width="6"/>
    <path d="M1331 872Q1316 856 1320 868ZM1331 872Q1346 856 1342 868Z" stroke="#3d72d0" stroke-width="4" fill="none"/>
    <rect x="1395" y="878" width="56" height="40" fill="#d8a52c"/>
    <path d="M1423 878V918M1395 894H1451" stroke="#c8202f" stroke-width="6"/>
    <rect x="1460" y="858" width="72" height="56" fill="#1f7a3e"/>
    <path d="M1496 858V914M1460 880H1532" stroke="#c8202f" stroke-width="6"/>
    <path d="M1496 858Q1478 840 1484 854ZM1496 858Q1514 840 1508 854Z" stroke="#c8202f" stroke-width="4" fill="none"/>
  </g>
</g>`
}

// falling snow

function snowLayer(cls: string, count: number, rMin: number, rMax: number): string {
  let flakes = ''
  for (let i = 0; i < count; i++) {
    const x = between(0, 1600)
    const y = between(0, 1000)
    const r = n(between(rMin, rMax))
    flakes += `<circle cx="${n(x)}" cy="${n(y)}" r="${r}"/><circle cx="${n(x)}" cy="${n(y - 1000)}" r="${r}"/>`
  }
  return `<g class="sway ${cls}-sway"><g class="${cls}">${flakes}</g></g>`
}

const STYLE = `
.tw1,.tw2,.tw3{fill:#fff;animation:twinkle 4s ease-in-out infinite alternate}
.tw2{animation-duration:5.5s}
.tw3{animation-duration:7s}
@keyframes twinkle{from{opacity:.95}to{opacity:.3}}
.spark{fill:#fff;transform-box:fill-box;transform-origin:center;animation:sparkle 6s ease-in-out infinite alternate}
@keyframes sparkle{from{opacity:1;transform:scale(1)}to{opacity:.4;transform:scale(.6)}}
.moonglow{animation:glow 9s ease-in-out infinite alternate}
@keyframes glow{from{opacity:1}to{opacity:.75}}
.team{fill:#141a36}
.team .legs,.team .rein{fill:none;stroke:#141a36;stroke-width:3;stroke-linecap:round}
.team .rein{stroke-width:1.4}
.flight{animation:fly 48s linear infinite}
@keyframes fly{0%{transform:translate(700px,90px)}62%{transform:translate(-1900px,-140px)}100%{transform:translate(-1900px,-140px)}}
.bob{animation:bob 3.2s ease-in-out infinite alternate}
@keyframes bob{from{transform:translateY(-7px)}to{transform:translateY(7px)}}
.smoke{fill:#c9d3ea;opacity:0;animation:smoke 9s ease-out infinite}
@keyframes smoke{0%{transform:translate(0,0) scale(.6);opacity:.55}100%{transform:translate(40px,-150px) scale(3);opacity:0}}
.smoke{transform-box:fill-box;transform-origin:center}
.winglow{animation:flicker 5s ease-in-out infinite alternate}
@keyframes flicker{from{opacity:1}to{opacity:.72}}
.head{transform-box:fill-box;transform-origin:0% 100%;animation:nod 7s ease-in-out infinite alternate}
@keyframes nod{0%,40%{transform:rotate(0deg)}100%{transform:rotate(6deg)}}
.l1,.l2,.l3{fill:#fff2a8;animation:blink 2.8s ease-in-out infinite alternate}
.l2{fill:#ffb3b3;animation-delay:-.9s}
.l3{fill:#b8dcff;animation-delay:-1.8s}
@keyframes blink{from{opacity:1}to{opacity:.25}}
.starglow{transform-box:fill-box;transform-origin:center;animation:pulse 4s ease-in-out infinite alternate}
@keyframes pulse{from{transform:scale(1);opacity:1}to{transform:scale(.8);opacity:.7}}
.rays{transform-box:fill-box;transform-origin:center;animation:spin 40s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.far,.mid,.near{fill:#fff}
.far{opacity:.55;animation:fall 46s linear infinite}
.mid{opacity:.75;animation:fall 30s linear infinite}
.near{opacity:.9;animation:fall 19s linear infinite}
@keyframes fall{from{transform:translateY(0)}to{transform:translateY(1000px)}}
.sway{animation:sway 8s ease-in-out infinite alternate}
.mid-sway{animation-duration:6s}
.near-sway{animation-duration:5s}
@keyframes sway{from{transform:translateX(-18px)}to{transform:translateX(18px)}}
@media (max-aspect-ratio: 4/5){
  .cabin{transform:translate(552px,370px) scale(.6)}
  .deer{display:none}
  .tree{transform:translate(94px,378px) scale(.6)}
  .moon{transform:translate(-470px,40px)}
}
`

export const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#070d24"/><stop offset=".45" stop-color="#14204a"/><stop offset=".75" stop-color="#2e4378"/><stop offset="1" stop-color="#3d548c"/>
  </linearGradient>
  <radialGradient id="milky"><stop offset="0" stop-color="#9fb2e8" stop-opacity=".18"/><stop offset="1" stop-color="#9fb2e8" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonGlow"><stop offset="0" stop-color="#fff8d8" stop-opacity=".75"/><stop offset=".35" stop-color="#e8e6c8" stop-opacity=".28"/><stop offset="1" stop-color="#c8d2f0" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonFace" cx=".4" cy=".4"><stop offset="0" stop-color="#fffef4"/><stop offset="1" stop-color="#f0e3b2"/></radialGradient>
  <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9b8e0"/><stop offset=".35" stop-color="#6f83bb"/><stop offset="1" stop-color="#34477e"/></linearGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d548c" stop-opacity="0"/><stop offset="1" stop-color="#4a5f98" stop-opacity=".8"/></linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfdaf0"/><stop offset="1" stop-color="#8ea2d0"/></linearGradient>
  <linearGradient id="drift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3fc"/><stop offset="1" stop-color="#aebee2"/></linearGradient>
  <radialGradient id="warm"><stop offset="0" stop-color="#ffc864" stop-opacity=".6"/><stop offset="1" stop-color="#ffc864" stop-opacity="0"/></radialGradient>
  <radialGradient id="starGlow"><stop offset="0" stop-color="#fff6c4" stop-opacity=".9"/><stop offset=".3" stop-color="#ffe27a" stop-opacity=".35"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>
</defs>
<style>${STYLE}</style>
<rect width="1600" height="1000" fill="url(#sky)"/>
<ellipse cx="760" cy="260" rx="950" ry="110" fill="url(#milky)" transform="rotate(-18 760 260)"/>
<g>${stars()}${sparkle(260, 120, 11)}${sparkle(520, 70, 9)}${sparkle(880, 150, 8)}${sparkle(140, 330, 7)}${sparkle(1460, 90, 9)}${sparkle(700, 300, 6)}</g>
<g class="moon">
  <circle class="moonglow" cx="1370" cy="200" r="300" fill="url(#moonGlow)"/>
  <circle cx="1370" cy="200" r="92" fill="url(#moonFace)"/>
  <g fill="#e2d39c" opacity=".55"><ellipse cx="1340" cy="175" rx="18" ry="13"/><ellipse cx="1395" cy="225" rx="24" ry="15"/><circle cx="1405" cy="165" r="9"/><circle cx="1330" cy="230" r="7"/></g>
</g>
<g class="flight"><g class="bob">${team()}</g></g>
<path d="M0 520L80 495L150 470L200 480L260 500L330 470L380 455L430 470L500 440L560 445L620 410L680 400L740 395L780 375L830 380L880 372L940 378L1000 390L1060 400L1120 420L1180 430L1240 445L1300 440L1360 460L1420 470L1500 480L1600 490V720H0Z" fill="url(#mtn)"/>
<path d="M1100 640L1250 612L1350 650L1450 622L1600 640V720H1100Z" fill="#4b609a"/>
<rect y="560" width="1600" height="180" fill="url(#mist)"/>
<path d="${forest(745, 55, 95, 26)}" fill="#22305e"/>
<path d="${forest(790, 70, 120, 30)}" fill="#141f48"/>
<path d="M0 805Q400 768 800 790T1600 778V1000H0Z" fill="url(#ground)"/>
<path d="M0 905Q320 858 720 885T1600 868V1000H0Z" fill="url(#drift)"/>
${snowLayer('far', 70, 0.8, 1.6)}
${cabin()}
${deer()}
${tree()}
${snowLayer('mid', 55, 1.6, 2.6)}
${snowLayer('near', 30, 2.6, 4.2)}
</svg>`
