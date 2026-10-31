// Mum (user, 2026-10-23): she stands in the kitchen with her arms folded, breathing, and her head follows you about
// the room — as far as a neck turns; go round behind her and she looks ahead again. The figure is the one he sent
// (assets/models/mother.glb: his model, its pictures shrunk — the colour from 8192 px to 4096, the rest to 1024, all
// JPEG — and its 188 000 triangles taken down to 66 000 in Blender, the same up close: 8 MB, not 90; whole, under the
// house's many lamps, she added a sixth to the time the house takes to draw, now a sixteenth. In Blender too its
// surface was joined up where it lay in pieces and made smooth again, all but its real edges, and its relief picture
// left out: round her eyes and down her nose the light broke in squares — the shading of each piece its own, and
// the relief picture meeting itself out of step at their seams — user, 2026-10-23). It comes
// rigged, with a few motions (walking, running, shouting), none of them standing still: the arms are folded here,
// bone by bone, after the picture he sent (2026-10-23): low, just over the apron's band, the forearms nearly level
// one on the other, the left on top, its hand laid flat along the right forearm, the right hand out of sight behind
// the left elbow. Its hands have no bones of their own, the fingers spread. Now and then (user, 2026-10-24) she walks
// over to the chopping board — the model's own walk — takes up the knife, cuts a few slices off the carrot, puts the
// knife back as it was and comes back to her place (ERRAND); her arms there are set bone by bone each frame (IK).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32, deg } from './util.js';
import { carrotSkinTex, carrotCutTex, irisTex } from './textures.js';

/**
 * Her arms, folded, in her own frame (metres; feet at 0, facing +z): how far each shoulder comes round forward
 * (rad: folded arms draw them in — and this rig's left shoulder sits 8 cm further back than its right), where each
 * elbow, wrist and fingertip go, and how far the forearm and the hand turn on themselves. Left over right. Found by
 * trying them out, thousands, measuring the skin (2026-10-23): no part of either arm in her or in the other arm; the
 * left forearm and its hand lying on the right forearm (1 mm off it: they hung 2 cm over it — user: "rest it on the
 * other arm"), the right forearm against her front (2 mm), and as little of the right hand showing as there can be.
 * (A hand laid instead of aimed — `orient` in place of `tip`, with GRIP — closed round the arm, her left elbow up to
 * let it: he liked the arms better as they are here — user, 2026-10-24.)
 */
export const FOLD = {
  Left: { shoulder: 0.4, elbow: [0.24, 1.081, 0.136], wrist: [-0.06, 1.103, 0.211], tip: [-0.172, 1.091, 0.129], roll: 0.6, hand: 0 },
  Right: { shoulder: 0.3, elbow: [-0.183, 1.02, 0.0845], wrist: [0.05, 1.07, 0.142], tip: [0.19, 1.17, 0.06], roll: -1.2, hand: -0.6 },
};
/** How far her left hand closes round the arm it holds (curlHand: rad, fingers knuckle to tip, and thumb); null: as modelled. */
export const GRIP = null;
/**
 * Her right hand closed to hold the knife: a fist round its handle (curlHand) — each finger bent at its three joints
 * just so far as to come round it (wrapFingers: found by trying them 5° at a time against the handle and the palm, and
 * written down here, deg, little finger first; user, 2026-10-25: curled round one line, they wound round it twisted,
 * "fix that index, I want every finger well made"). `slant`: how far the handle crosses the palm from the line of the
 * knuckles towards the wrist (from the heel of the hand out between thumb and forefinger: at 45°, as it was, the little
 * finger could not have come round it; at 22° the wrist had to bend 56° to put the knife on the board); `at`: its
 * middle from the hand's (m: back towards the wrist, out to the palm's side), in the hollow of the palm; `over`: the
 * thumb over the top of it, its pad on its left side (curlHand; user, 2026-10-25: "on the left side of the handle, not
 * on top"); `roll`: the hand turned that far over round the handle, its back up a little, its palm down a little — so
 * the thumb comes down onto that side rather than lying along the top; `late`: how far behind the fingers the thumb
 * closes in the shapes on the way (below 1: ahead of them — as modelled, open, it lies where the handle comes, and has
 * to be out of its way first).
 */
const FIST_STAGES = [1 / 3, 2 / 3, 1]; // (how far closed each of its shapes is, in order: see `hands`)
const FIST = {
  slant: deg(32), roll: deg(34), over: [0.04, 0.008, 0.035, 1, 30], late: 0.3,
  handle: { at: [-0.024, 0.016], half: [0.008, 0.012], corner: 0.006, bent: [[90, 50, 38], [85, 70, 42], [75, 80, 60], [40, 70, 52]] },
};
/**
 * Her forearm in line with the hand holding the knife, bar the bend at the wrist towards the little finger a hand
 * holding a handle has (rad): left to itself, the elbow went wherever it would and the wrist bent back on itself
 * (user, 2026-10-25: "the arm's position is completely unnatural, the wrist bends horribly").
 */
const ULNAR = deg(30); // (with `slant`, the knife ~30° off the forearm's line: the fist as in his picture, the wrist cocked as one is to chop)
/**
 * How she stands to cut (user, 2026-10-25: square to the board, behind the knife, her elbow went into her): turned
 * `turn` to her right of square to it (rad), so the knife goes away from her across her, and stood so that the knife's
 * handle is `hand` from her (m: to her right, before her) — her forearm then comes to it from beside her waist. (Nearer,
 * turned so, her left knee was in the cupboard doors; 4 cm further to her right, as it was until the fist was remade
 * round a handle less slanted in it, her elbow went into her waist as the cuts came along the carrot.)
 */
const STANCE = { turn: deg(30), hand: [0.14, 0.32] };
/**
 * Her errand (user, 2026-10-24: "now and then she goes to the chopping board and starts cutting a carrot with the
 * knife"): `first`: how long she stays put once you first come into the living room, over the line from the corridor
 * (s: user, 2026-10-25), `every`: how long she stands between one time and the next (s); `pace`: how fast she walks,
 * of the walk's own (`WALK`, the stride as it comes, brisk); `cuts`: how many slices she cuts a time; `chop`: how long
 * a cut takes (s) — the first, careful one, and once she is into it; `slice`: how thick each (m).
 */
const ERRAND = { first: 15, every: [45, 100], pace: 0.72, cuts: [6, 10], chop: [4.2, 2.72], slice: 0.005 }; // (cuts four times slower: user, 2026-10-25)
/**
 * As she cuts (user, 2026-10-25): every `every` s of it she stops, the knife down on the board, and her head comes up
 * your way all at once (user, 2026-10-28: "not slow, sudden" — `snap`: s to settle, rad/s at most) — wherever you
 * are, as far as a neck turns — and stays on you 6 s; then it goes back very slowly (`ease`, `speed`, as it used to
 * come up too): at the board again from `at` s, cutting again at `back`.
 */
const LOOKS = { every: 5, snap: [0.1, 7], at: 6.3, back: 9.3, ease: 1.1, speed: 0.42 };
const WALK = 1.47; // (m/s: how far a foot goes back while it is down, over the time it is, in the model's walk)
/**
 * The carrot on the chopping board, in the board's frame (m): its crown at `top` along x, `len` long down towards +x,
 * `r` across at the shoulder, along `z`; `bend`: how far it bows to one side (no carrot grows straight).
 */
const CARROT = { top: -0.12, len: 0.22, z: 0.103, r: 0.021, bend: 0.005 }; // (its tip 11 cm short of the board's edge: room for the slices) // (bigger: user, 2026-10-25 — it was 17 cm, 3.3 across)
/** Its radius `t` m down it from the crown: full at the shoulder, tapering to a thin tip, never quite even. */
const carrotR = (t) => (CARROT.r * Math.pow(Math.max(0, 1 - t / CARROT.len), 0.55) + 0.0016) * (1 + 0.01 * Math.sin(t * 240) + 0.025 * Math.sin(t * 61 + 1));
/** How far it bows to the side `t` m down it. */
const carrotBow = (t) => CARROT.bend * Math.sin((Math.PI * t) / CARROT.len);

/**
 * A carrot as far as `len` m from its crown (its leaves cut off short), lying along +x; open at that end (the face
 * where it was cut is a mesh of its own). Its skin's picture runs the length of the whole carrot, so it stays put as
 * the carrot gets shorter.
 */
function carrotGeo(len) {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.55 * CARROT.r, 0.0006), new THREE.Vector2(0.82 * CARROT.r, 0.003)];
  for (let t = 0.006; t < len; t += 0.004) pts.push(new THREE.Vector2(carrotR(t), t));
  pts.push(new THREE.Vector2(carrotR(len), len));
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateZ(-Math.PI / 2); // (its length from up the lathe's y onto +x)
  const P = geo.attributes.position, U = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const t = P.getX(i);
    U.setY(i, t / CARROT.len);
    P.setZ(i, P.getZ(i) + carrotBow(t));
  }
  return geo;
}
/** Her head left to itself, in her own frame (radians): down a little, at a child's height, a touch to one side. */
const REST = { yaw: 0.05, pitch: 0.16, roll: 0.03 };
/**
 * How she looks at you. `reach`: the furthest her head turns (her eyes do the rest: EYES); `find`: how far off
 * straight ahead she notices you; `lose`: past this you are behind her (head and eyes as far round as they go: till
 * then she has you in the corner of her eye); `up`/`down`: how far it tips; `slack`: how far you may move before the
 * head goes after you — the eyes take up less than that — and `lag`, how long after them it goes (s); `react`,
 * `letGo`: how long before she turns to you, and back ahead once you are gone (s); `ease`, `speed`: how a turn goes
 * (s to settle, rad/s at most).
 */
const LOOK = { reach: deg(75), find: deg(85), lose: deg(112), up: deg(-20), down: deg(40), slack: deg(7), lag: 0.22, react: [0.25, 0.5], letGo: [0.6, 1.1], ease: 0.2, speed: 3.5 };
/** What of a turn each part takes: the chest a little, the neck, the head the rest. */
const SHARE = { Spine2: [0, 0.1, 0], Neck: [0.4, 0.35, 0.4], Head: [0.6, 0.55, 0.6] };
/**
 * Her eyes (user, 2026-10-28: "follow you with the pupils … and the eyelids blink now and then, nervously"). They come
 * painted on her face, looking straight ahead; measured off it, as modelled and seen from in front (2026-10-28): `at`,
 * the painted irises' middles (m); the openings round them (mm from there, x across her face, + to her left; y up):
 * `ends`, how far they go each way, `top` and `bottom`, their lids' edges (polynomials in x, the painted outline to a
 * millimetre). In there the painted iris is taken out (`painted` mm round its middle, the white either side carried
 * across it: its soft edge goes out to 8 mm on one side — taken out only to 7, it stayed round the new one as a
 * greenish ring, user 2026-10-28) and drawn again on a ball `ball` mm across, behind the face, turned where she looks: `iris`, its radius
 * (mm), `turn`, how far an eye goes off straight ahead (sideways, down, up). The upper lid comes down over it from
 * the top of the painted lashes (`lash` mm over the opening): to blink, and some of the way as she looks down
 * (`lower`, of the opening, at `turn`'s full down).
 */
const EYES = {
  at: [[-0.04333, 1.52511, 0.1022], [0.03176, 1.52719, 0.1076]],
  ends: [[-15.5, 12.9], [-13, 15]],
  top: [[8.44, -0.1387, -0.01147, -0.0001141, -0.0001355], [8.552, -0.01194, -0.02575, 0.001139, -0.00005813]],
  bottom: [[-7.526, 0.04464, 0.02483, 0.00006733, 0.00005722], [-7.519, -0.006354, 0.02517, 0.000405, 0.00002244]],
  painted: 8.3, ball: 12, iris: 6.3, turn: [deg(38), deg(-30), deg(20)], lash: 2.6, lower: 0.4,
};
/**
 * How her eyes go from one thing to the next (as eyes do): a jump (`jump`: once what she looks at is that far off
 * where they point, `late` s after; over in 20–80 ms, the further the longer), and in between they follow it smoothly
 * and hold still on it — not quite: every `still` s a jump too small to see but as eyes are never still, `jitter`.
 * While she cuts, now and then she looks up at you with her eyes alone, her head down over the board — up from under
 * her brows, as far as they go (`glance`: how often, for how long, s).
 */
const GAZE = { jump: deg(1.5), late: [0.1, 0.17], still: [0.5, 1.6], jitter: deg(0.5), glance: { every: [6, 12], hold: [0.6, 1.2] } };
/**
 * Her blinks, nervous: closer together than most people's (about 24 a minute against 15–20) and never evenly (`every`,
 * s, more often short), a second or third straight after now and then (`again`, `thrice`: how likely), and with a big
 * jump of the eyes (`withJump`, over `big`); each shut in `shut` s, held `hold`, open again more slowly, `open`.
 */
const BLINK = { every: [1.4, 5.5], again: 0.2, thrice: 0.06, withJump: 0.5, big: deg(15), shut: 0.075, hold: 0.035, open: 0.17 };
/**
 * Where her face round the eyes is pictured as seen from in front (m, as modelled: x, y, width, height), for the eyes:
 * in the bottom 320 rows of a picture 1024 × 512 (8 to the millimetre), the iris (irisTex) in a corner above.
 */
const EYE_BOX = [-0.068, 1.508, 0.128, 0.04];

/** The eyes in her skin's shader: the uniforms and helpers, and what goes after the colour is read (EYES). */
const glsl = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(+v.toPrecision(7)));
const horner = (c) => c.slice(0, -1).reduceRight((s, k) => `${glsl(k)} + x * ( ${s} )`, glsl(c[c.length - 1]));
const EYE_HEAD = `uniform sampler2D uEyeTex;
uniform vec4 uEyeBox;
uniform vec3 uGaze[ 2 ];
uniform float uLid;
varying vec3 vBind;
vec3 eyeAt( vec2 p, vec2 gx, vec2 gy ) { return textureGrad( uEyeTex, ( p - uEyeBox.xy ) * uEyeBox.zw, gx, gy ).rgb; }
float eyeHash( float n ) { return fract( sin( n * 127.1 ) * 43758.5453 ); }
`;
const EYE_MAIN = `	float eyeWet = 0.0;
	{
		bool second = vBind.x > ${glsl((EYES.at[0][0] + EYES.at[1][0]) / 2)};
		vec3 at = second ? vec3( ${EYES.at[1].map(glsl).join(', ')} ) : vec3( ${EYES.at[0].map(glsl).join(', ')} );
		vec2 q = ( vBind.xy - at.xy ) * 1000.0; // (mm)
		vec2 gx = dFdx( vBind.xy ) * uEyeBox.zw, gy = dFdy( vBind.xy ) * uEyeBox.zw;
		float s = max( fwidth( q.y ), 0.05 );
		// the iris on its ball, the ball turned where she looks
		vec3 g = second ? uGaze[ 1 ] : uGaze[ 0 ];
		vec2 d = q / ${glsl(EYES.ball)};
		float dd = dot( d, d );
		vec3 n = vec3( d, sqrt( max( 1.0 - dd, 0.0 ) ) );
		vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), g ) ), up = cross( g, right );
		vec2 iuv = vec2( dot( n, right ), dot( n, up ) ) / ${glsl(EYES.iris / EYES.ball)};
		float ir = length( iuv ), irw = max( fwidth( ir ), 0.01 );
		vec2 igx = dFdx( iuv ) * vec2( 0.094, 0.1875 ), igy = dFdy( iuv ) * vec2( 0.094, 0.1875 ); // (the iris: in the corner of the same picture)
		if ( vBind.z > 0.06 && abs( q.x ) < 18.0 && q.y > -10.0 && q.y < 12.0 ) {
			float x = q.x;
			float top = second ? ${horner(EYES.top[1])} : ${horner(EYES.top[0])};
			float bot = second ? ${horner(EYES.bottom[1])} : ${horner(EYES.bottom[0])};
			vec2 ends = second ? vec2( ${EYES.ends[1].map(glsl).join(', ')} ) : vec2( ${EYES.ends[0].map(glsl).join(', ')} );
			float across = smoothstep( ends.x, ends.x + 1.2, x ) * ( 1.0 - smoothstep( ends.y - 1.2, ends.y, x ) );
			float open = across * smoothstep( bot, bot + 0.25 + s, q.y ) * ( 1.0 - smoothstep( top - 0.25 - s, top, q.y ) );
			vec3 col = diffuseColor.rgb;
			// the painted iris taken out: the white either side of it, carried across
			float r = length( q ), P = ${glsl(EYES.painted)};
			if ( r < P ) {
				float hw = sqrt( P * P - q.y * q.y ) + 0.35;
				vec3 a = eyeAt( at.xy + vec2( -hw, q.y ) * 0.001, gx, gy ), b = eyeAt( at.xy + vec2( hw, q.y ) * 0.001, gx, gy );
				col = mix( col, mix( a, b, clamp( ( x + hw ) / ( 2.0 * hw ), 0.0, 1.0 ) ), smoothstep( P, P - 0.6, r ) * open );
			}
			vec3 iris = textureGrad( uEyeTex, vec2( 0.0, 0.625 ) + ( clamp( iuv, -1.0, 1.0 ) * 0.5 + 0.5 ) * vec2( 0.1875, 0.375 ), igx, igy ).rgb * ( 0.8 + 0.2 * n.z );
			col = mix( col, iris, ( 1.0 - smoothstep( 1.0 - irw, 1.0 + irw, ir ) ) * step( 0.0, dot( n, g ) ) * step( dd, 1.0 ) * open );
			// the upper lid, its edge as far down as it has come: its shadow on the eye under it, its lashes hanging
			float edge = mix( top, bot + 0.2, uLid ), on = smoothstep( 0.0, 0.08, uLid ), below = edge - q.y, under = on * open * step( 0.0, below );
			col *= 1.0 - 0.45 * under * ( 1.0 - smoothstep( 0.0, 1.8, below ) );
			float len = 0.5 + 0.8 * eyeHash( floor( x / 0.3 ) + ( second ? 37.0 : 0.0 ) );
			float strand = 1.0 - smoothstep( 0.05, 0.12, abs( fract( x / 0.3 + below * 0.12 ) - 0.5 ) * 0.3 );
			col = mix( col, vec3( 0.042, 0.018, 0.01 ), 0.85 * under * strand * ( 1.0 - smoothstep( 0.0, len, below ) ) );
			// the lid itself: the skin over the painted lashes, folded down over the eye (the skin above them, mirrored
			// about their top, closer, and softened: lids are smooth), its rim dark where the lashes grow
			float crown = top + ${glsl(EYES.lash)};
			float lid = on * across * smoothstep( edge - s, edge + s, q.y ) * ( 1.0 - smoothstep( crown - 0.5, crown, q.y ) );
			float ys = crown + 0.3 + ( crown - q.y ) * 0.3;
			vec3 skin = 0.5 * ( eyeAt( at.xy + vec2( x - 0.5, ys ) * 0.001, gx * 3.0, gy * 3.0 ) + eyeAt( at.xy + vec2( x + 0.5, ys ) * 0.001, gx * 3.0, gy * 3.0 ) );
			skin *= 0.82 + 0.18 * smoothstep( 0.0, 1.5, q.y - edge );
			col = mix( col, mix( vec3( 0.042, 0.018, 0.01 ), skin, smoothstep( 0.15, 0.55, q.y - edge ) ), lid );
			diffuseColor.rgb = col;
			eyeWet = open * ( 1.0 - lid );
		}
	}`;
/**
 * Her breathing: a breath every few seconds, never two alike. At the top of one the chest stands out by `swell` (m,
 * most of it in front, under the collarbones), and the shoulders — and the folded arms on the chest with them — go
 * `lift` up and forward (m, in her frame).
 */
const BREATH = { every: [3.7, 4.7], depth: [0.8, 1.1], swell: 0.0045, lift: [0, 0.005, 0.006] }; // (the swell halved, the shoulders as they were — user, 2026-10-23)

/**
 * Her skin, cooler (user, 2026-10-23: "15% cold filter on her skin"): a photo filter's — the colour multiplied by a
 * cold blue (`filter`), as light as it was, and `density` of that over it.
 */
const SKIN = { filter: [0, 0.43, 1], density: 0.15 };

/**
 * Which of her is skin, 1 or 0 for each point of `geo` (held by the skeleton `bones`): the model comes cut into
 * pieces, each laid out on its own in the picture `img` — a hand, the face; the clothes and the hair pieces of their
 * own — and a piece is skin when it is on her head, neck or the top of her chest, her forearms or hands, and over
 * 40% of its points are skin-coloured there (the face's painted brows and shadows bring it down to half; the
 * apron's pieces, its cream skin's colour, never reach a third). Lower down she is all clothes and stockings.
 */
function skinOf(geo, img, bones) {
  const n = geo.attributes.position.count, I = geo.index.array, UV = geo.attributes.uv, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const bare = bones.map((b) => /Head|headfront|Neck|Spine2|ForeArm|Hand/.test(b.name));
  const up = Int32Array.from({ length: n }, (_, i) => i), find = (a) => { while (up[a] !== a) a = up[a] = up[up[a]]; return a; };
  for (let f = 0; f < I.length; f += 3) { const a = find(I[f]); up[find(I[f + 1])] = a; up[find(I[f + 2])] = a; }
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, S, S);
  const px = x.getImageData(0, 0, S, S).data, tally = new Map();
  for (let i = 0; i < n; i++) {
    const k = (Math.min(S - 1, Math.floor(UV.getY(i) * S)) * S + Math.min(S - 1, Math.floor(UV.getX(i) * S))) * 4;
    const r = px[k], g = px[k + 1], b = px[k + 2], hi = Math.max(r, g, b), d = hi - Math.min(r, g, b);
    const hue = d ? (60 * (hi === r ? (g - b) / d : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) + 360) % 360 : 0;
    const skin = hue > 10 && hue < 34 && d / hi > 0.28 && d / hi < 0.58 && hi > 115 ? 1 : 0;
    let w = 0, bone = 0;
    for (let q = 0; q < 4; q++) if (SW.getComponent(i, q) > w) { w = SW.getComponent(i, q); bone = SI.getComponent(i, q); }
    const t = tally.get(find(i)) ?? [0, 0, 0];
    t[0] += skin;
    t[1]++;
    t[2] += bare[bone] ? 1 : 0;
    tally.set(find(i), t);
  }
  return Float32Array.from({ length: n }, (_, i) => { const [s, all, up] = tally.get(find(i)); return all >= 6 && up / all > 0.5 && s / all > 0.4 ? 1 : 0; });
}

/**
 * The specks (user, 2026-10-23: "little triangles here and there where the skin looks orange"): bits of one or two
 * triangles left on their own in the picture by taking the model down, each on a corner of it a deeper orange than
 * the skin round it. Each piece of fewer than `few` points takes its picture (and its skin, `skin`) from the nearest
 * points of the larger piece nearest it, so it is the skin it lies in.
 */
function mendSpecks(geo, skin, few = 12) {
  const n = geo.attributes.position.count, I = geo.index.array, P = geo.attributes.position, UV = geo.attributes.uv;
  const up = Int32Array.from({ length: n }, (_, i) => i), find = (a) => { while (up[a] !== a) a = up[a] = up[up[a]]; return a; };
  for (let f = 0; f < I.length; f += 3) { const a = find(I[f]); up[find(I[f + 1])] = a; up[find(I[f + 2])] = a; }
  const size = new Map(), members = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); size.set(r, (size.get(r) ?? 0) + 1); (members.get(r) ?? members.set(r, []).get(r)).push(i); }
  const cell = 0.01, grid = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) if (size.get(find(i)) >= few) { const k = key(P.getX(i), P.getY(i), P.getZ(i)); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
  const nearest = (x, y, z, piece = -1) => {
    let best = -1, bd = Infinity;
    for (let reach = 1; reach <= 4 && best < 0; reach++) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) for (let c = -reach; c <= reach; c++) {
        for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
          if (piece >= 0 && find(j) !== piece) continue;
          const d = (P.getX(j) - x) ** 2 + (P.getY(j) - y) ** 2 + (P.getZ(j) - z) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
      }
    }
    return best;
  };
  for (const [r, pts] of members) {
    if (size.get(r) >= few) continue;
    const m = pts.reduce((s, i) => [s[0] + P.getX(i), s[1] + P.getY(i), s[2] + P.getZ(i)], [0, 0, 0]).map((v) => v / pts.length);
    const home = nearest(...m);
    if (home < 0) continue;
    for (const i of pts) { // (all its points into the one piece: across two, its picture would stretch over the gap)
      const j = nearest(P.getX(i), P.getY(i), P.getZ(i), find(home));
      UV.setXY(i, UV.getX(j), UV.getY(j));
      skin[i] = skin[j];
    }
  }
  UV.needsUpdate = true;
}

/**
 * The four fingers of a hand closed round a handle, each on its own, bent at its three joints just so far as to come
 * round it: curled round one slanted line they wound round it like a spring, stretched and twisted, the forefinger into
 * the thumb (user, 2026-10-25: "fix that index, I want every finger well made"). `hand`: its points (`ids` of `P`), its
 * axes and middle (curlHand), `skip(i)`: whether a point is the thumb's. The handle lies as `lie` lays the knife in the
 * hand (`slant`, `roll`: FIST); its section is `half` (m: half across its face, half up its height) with `corner`
 * rounded off, its middle `at` (m: along the hand, towards the palm, from the hand's middle). Returns where each point
 * goes (`place`: by its slot in `ids`), the handle's middle and its way.
 */
function wrapFingers(P, ids, { along, across, palm, mid, toPalm }, skip, { slant, roll, at, half, corner, bent: given = null, part = 1 }) {
  const V = THREE.Vector3;
  // the knife's axes in the hand's (as lie() turns the hand: its across and palm given in the knife's, its along their cross)
  const C = new V(Math.cos(slant), Math.sin(slant) * Math.sin(roll), Math.sin(slant) * Math.cos(roll)), Pk = new V(0, Math.cos(roll), -Math.sin(roll));
  const A = toPalm > 0 ? new V().crossVectors(C, Pk) : new V().crossVectors(Pk, C);
  const [kx, ky, kz] = [0, 1, 2].map((k) => new V().addScaledVector(along, A.getComponent(k)).addScaledVector(across, C.getComponent(k)).addScaledVector(palm, Pk.getComponent(k)));
  const centre = mid.clone().addScaledVector(along, at[0]).addScaledVector(palm, at[1]), r = new V();
  const sdf = (p) => {
    r.subVectors(p, centre);
    const u = Math.abs(r.dot(ky)) - half[0] + corner, w = Math.abs(r.dot(kz)) - half[1] + corner;
    return Math.hypot(Math.max(u, 0), Math.max(w, 0)) + Math.min(Math.max(u, w), 0) - corner;
  };
  const co = ids.map((i) => { const d = new V().fromBufferAttribute(P, i).sub(mid); return [d.dot(along), d.dot(across), d.dot(palm)]; });
  // the fingers: what stands apart past the webs, side by side across the hand, the little finger's first
  const far = ids.map((_, k) => k).filter((k) => co[k][0] > 0.035 && !skip(ids[k])).sort((x, y) => co[x][1] - co[y][1]);
  let runs = [[far[0]]];
  for (let k = 1; k < far.length; k++) { if (co[far[k]][1] - co[far[k - 1]][1] > 0.003) runs.push([]); runs.at(-1).push(far[k]); }
  runs = runs.sort((x, y) => y.length - x.length).slice(0, 4).sort((x, y) => co[x[0]][1] - co[y[0]][1]);
  const line = (pts, f) => { // (least squares: f(point) against its along)
    const n = pts.length, mt = pts.reduce((s, p) => s + p[0], 0) / n, mv = pts.reduce((s, p) => s + f(p), 0) / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p[0] - mt) * (f(p) - mv); den += (p[0] - mt) ** 2; }
    return [mv - (num / den) * mt, num / den];
  };
  const S = (x) => (x <= -0.5 ? 0 : x >= 0.5 ? 1 : (x + 0.5) ** 2 * (2 - 2 * x));
  const middleTip = Math.max(...runs[2].map((k) => co[k][0])), LONG = [0.76, 0.94, 1, 0.92]; // (each finger's length from its knuckle, the middle one's 1)
  const fingers = runs.map((run, f) => {
    const [a0, a1] = line(run.map((k) => co[k]), (p) => p[1]), tip = Math.max(...run.map((k) => co[k][0]));
    // its middle line, down its length: halfway between its back and its front, every 5 mm from its knuckle out
    const centres = [];
    for (let t = -0.005; t < tip - 0.008; t += 0.005) {
      const hs = co.filter((p, k) => p[0] >= t && p[0] < t + 0.005 && Math.abs(p[1] - (a0 + a1 * t)) < 0.006 && !skip(ids[k])).map((p) => p[2]);
      if (hs.length > 2) centres.push([t + 0.0025, (Math.min(...hs) + Math.max(...hs)) / 2]);
    }
    const [h0, h1] = line(centres, (p) => p[1]);
    const u = along.clone().addScaledVector(across, a1).addScaledVector(palm, h1).normalize(), n = palm.clone().addScaledVector(u, -palm.dot(u)).normalize();
    const L = (middleTip + 0.002) * LONG[f], tm = tip - L; // (the knuckles in an arc, the middle finger's 2 mm short of the hand's middle)
    const M = mid.clone().addScaledVector(along, tm).addScaledVector(across, a0 + a1 * tm).addScaledVector(palm, h0 + h1 * tm);
    return { a0, a1, u, n, c: new V().crossVectors(u, n), M, L, tm, axis: new V().crossVectors(u, n), j: [0, 0.48 * L, 0.78 * L], w: [0.028, 0.022, 0.016].map((w) => (w * L) / 0.092) }; // (each joint's bend spread over so much of its length: the skin over the knuckles no more than twice as long)
  });
  // how far each joint has turned at a distance s past the knuckle, and the course of the finger's middle line bent so
  // (every half millimetre from 3 cm short of the knuckle, where nothing is bent yet)
  const S0 = -0.03, DS = 0.0005, YN = 0.001; // (bent about a line 1 mm to the palm's side of the finger's middle)
  const turned = (F, ang, s) => ang[0] * S(s / F.w[0]) + ang[1] * S((s - F.j[1]) / F.w[1]) + ang[2] * S((s - F.j[2]) / F.w[2]);
  const course = (F, ang) => {
    const n = Math.ceil((F.L + 0.05) / DS), xs = new Float32Array(n + 1), ys = new Float32Array(n + 1);
    xs[0] = S0;
    for (let k = 0; k < n; k++) { const th = turned(F, ang, S0 + (k + 0.5) * DS); xs[k + 1] = xs[k] + Math.cos(th) * DS; ys[k + 1] = ys[k] + Math.sin(th) * DS; }
    return { xs, ys, n };
  };
  const d = new V();
  const bent = (F, ang, way, p, out, nIn = null, nOut = null) => {
    d.subVectors(p, F.M);
    const s = d.dot(F.u), y = d.dot(F.n), c = d.dot(F.c);
    if (s <= S0) { out.copy(p); if (nIn) nOut.copy(nIn); return out; }
    const x = Math.min((s - S0) / DS, way.n), k = Math.min(Math.floor(x), way.n - 1), f = x - k, th = turned(F, ang, s);
    const qx = way.xs[k] + (way.xs[k + 1] - way.xs[k]) * f + Math.max(0, (s - S0) / DS - way.n) * DS, qy = way.ys[k] + (way.ys[k + 1] - way.ys[k]) * f;
    const cos = Math.cos(th), sin = Math.sin(th);
    out.copy(F.M).addScaledVector(F.u, qx - (y - YN) * sin).addScaledVector(F.n, qy + YN + (y - YN) * cos).addScaledVector(F.c, c);
    if (nIn) nOut.copy(nIn).applyAxisAngle(F.axis, th);
    return out;
  };
  // the palm's front, 5 by 8 mm at a time: where a fingertip coming back round must stop
  const cell = (t, a) => `${Math.floor(t / 0.005)},${Math.floor(a / 0.008)}`, front = new Map();
  co.forEach((p, k) => { if (!skip(ids[k])) front.set(cell(p[0], p[1]), Math.max(front.get(cell(p[0], p[1])) ?? -1, p[2])); });
  // each finger's three joints, tried in 5° steps: as far round as they go without going into the handle or the palm
  const deg5 = Math.PI / 36, o = new V(), g = new V();
  for (const [f, F] of fingers.entries()) {
    if (given) { F.ang = given[f].map((a) => (part * a * Math.PI) / 180); F.way = course(F, F.ang); continue; } // (found once, written down: deg; `part`: only so far closed)
    const own = co.map((p, k) => k).filter((k) => !skip(ids[k]) && Math.abs(co[k][1] - (F.a0 + F.a1 * co[k][0])) < 0.0075 && d.fromBufferAttribute(P, ids[k]).sub(F.M).dot(F.u) > 0);
    const test = own.filter((_, k) => k % Math.ceil(own.length / 140) === 0).map((k) => { const p = new V().fromBufferAttribute(P, ids[k]); return { p, front: d.subVectors(p, F.M).dot(F.n) > 0, s: d.dot(F.u) }; });
    let best = null;
    for (let a = 0; a <= 20; a++) for (let b = 0; b <= 22; b++) for (const k of [0.45, 0.6, 0.75]) {
      const ang = [a * deg5, b * deg5, k * b * deg5], way = course(F, ang);
      let into = 0, gap = 0, n = 0;
      for (const T of test) {
        bent(F, ang, way, T.p, o);
        const e = sdf(o);
        if (e < 0.0015) into += (0.0015 - e) ** 2;
        g.subVectors(o, mid);
        const t = g.dot(along), h = g.dot(palm), top = front.get(cell(t, g.dot(across)));
        if (T.s > 0.6 * F.L && t < F.tm - 0.004 && top !== undefined && h < top + 0.003) into += (top + 0.003 - h) ** 2; // (its tip: at its root the skin folds)
        if (T.front && T.s > 0.35 * F.L) { gap += Math.max(0, e - 0.0015); n++; }
      }
      const cost = 1e6 * into + gap / Math.max(n, 1) + 0.003 * (ang[2] - 0.6 * ang[1]) ** 2;
      if (!best || cost < best.cost) best = { cost, ang };
    }
    F.ang = best.ang;
    F.way = course(F, F.ang);
  }
  // which finger each point goes with: past the webs its own, the nearest; short of them the skin between two goes
  // with both, as near as it is to each across the hand
  const webs = fingers.slice(1).map((F, f) => {
    const t = 0.02, m = (fingers[f].a0 + fingers[f].a1 * t + F.a0 + F.a1 * t) / 2;
    return Math.max(...co.filter((p) => Math.abs(p[1] - m) < 0.002).map((p) => p[0]));
  });
  const shares = co.map(([t, a]) => {
    const cs = fingers.map((F) => F.a0 + F.a1 * Math.max(t, -0.02)), w = [0, 0, 0, 0];
    let near = 0;
    cs.forEach((c, f) => { if (Math.abs(a - c) < Math.abs(a - cs[near])) near = f; });
    if (a <= cs[0]) w[0] = 1;
    else if (a >= cs[3]) w[3] = 1;
    else for (let f = 0; f < 3; f++) if (a >= cs[f] && a < cs[f + 1]) { const l = S((a - cs[f]) / (cs[f + 1] - cs[f]) - 0.5); w[f] = 1 - l; w[f + 1] = l; }
    const side = a > cs[near] ? near : near - 1, web = webs[side] ?? -1, own = side < 0 || side > 2 ? 1 : THREE.MathUtils.smoothstep(t, web - 0.012, web + 0.002);
    return w.map((x, f) => x * (1 - own) + (f === near ? own : 0));
  });
  const p1 = new V(), n1 = new V();
  return {
    centre, way: kx,
    place(k, p, n) {
      const ps = new V(), ns = new V(), w = shares[k];
      for (let f = 0; f < 4; f++) if (w[f] > 0) { bent(fingers[f], fingers[f].ang, fingers[f].way, p, p1, n, n1); ps.addScaledVector(p1, w[f]); ns.addScaledVector(n1, w[f]); }
      p.copy(ps);
      n.copy(ns).normalize();
    },
  };
}

/**
 * Her left hand closed a little round what it holds (user, 2026-10-23: the hand laid on the other arm, the thumb a
 * little behind it): the model's fingers are spread flat and have no bones, so the shape itself is bent, as it
 * stands in the model (arms out). The hand's lie is found from its points — along it, across it, and the way its palm
 * faces (the way the fingers already turn a little) — then the fingers bend in towards the palm past the knuckles,
 * `fingers` (rad, from knuckle to tip of a finger 9 cm long), round a line `slant` (rad) off straight across the hand
 * (in a fist the little finger closes nearer the wrist than the first), and the thumb swings in round the hand's
 * length towards the palm, `thumb`. `side`: 'Left' or 'Right'; `forward`, if given: the way the thumb points, roughly,
 * as modelled. Returns the hand's axes as modelled, where its middle is from the wrist along them, and the line the
 * fingers close round (`hollow`, from the wrist, and `round`, its way: from the little finger's side to the thumb's).
 */
export function curlHand(geo, bones, { fingers = 0.9, thumb = 0.8, slant = 0, roll = 0, over = null, zone = [0.024, 0.04, -0.004, 0.01], handle = null, part = 1, late = 1 } = {}, side = 'Left', forward = null) {
  const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const held = [side + 'Hand', side + 'HandMiddle4'].map((n) => bones.findIndex((b) => b.name === 'mixamorig' + n));
  const ids = [], v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (held.includes(SI.getComponent(i, k))) w += SW.getComponent(i, k);
    if (w > 0.5) ids.push(i);
  }
  // its middle, and its axes: along (the longest), across, through (the thinnest: the palm's facing)
  const mid = new THREE.Vector3();
  for (const i of ids) mid.add(v.fromBufferAttribute(P, i));
  mid.divideScalar(ids.length);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const i of ids) { const d = v.fromBufferAttribute(P, i).sub(mid).toArray(); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += d[a] * d[b]; }
  const times = (u) => new THREE.Vector3(C[0] * u.x + C[1] * u.y + C[2] * u.z, C[3] * u.x + C[4] * u.y + C[5] * u.z, C[6] * u.x + C[7] * u.y + C[8] * u.z);
  let along = new THREE.Vector3(1, -1, 0).normalize(), across = new THREE.Vector3(0, 0, 1);
  for (let k = 0; k < 60; k++) along = times(along).normalize();
  for (let k = 0; k < 60; k++) { across = times(across); across.addScaledVector(along, -across.dot(along)).normalize(); }
  const at = (i, out) => out.fromBufferAttribute(P, i).sub(mid);
  // the fingers point away from the forearm; the palm is the side the fingertips already turn to; the thumb's is the
  // side that stands out short of the knuckles and stops there (the little finger's side of the palm is as wide by
  // the wrist, but runs on into the fingers)
  const forearm = bones.findIndex((b) => b.name === 'mixamorig' + side + 'ForeArm');
  let elbowSide = 0, tipT = 0, tipH = 0;
  const palm = new THREE.Vector3().crossVectors(along, across);
  for (let i = 0; i < P.count; i++) if (SI.getComponent(i, 0) === forearm && SW.getComponent(i, 0) > 0.8) elbowSide += at(i, v).dot(along);
  if (elbowSide > 0) along.negate();
  for (const i of ids) { const d = at(i, v), t = d.dot(along); if (t > tipT) { tipT = t; tipH = d.dot(palm); } }
  if (tipH < 0) palm.negate();
  const out = { before: [0, 0], after: [0, 0] }; // (how far each side, + and −, stands out before the knuckles and after)
  for (const i of ids) {
    const d = at(i, v), t = d.dot(along), a = d.dot(across), span = t > -0.03 && t < -0.01 ? out.before : t > 0.01 && t < 0.03 ? out.after : null;
    if (span) { span[0] = Math.max(span[0], a); span[1] = Math.max(span[1], -a); }
  }
  if (out.before[1] - out.after[1] > out.before[0] - out.after[0]) across.negate();
  if (forward && across.dot(forward) < 0) across.negate(); // (where the shape can't tell: on her right hand it took the little finger's side)
  const towardPalm = Math.sign(new THREE.Vector3().crossVectors(along, across).dot(palm)); // (which way round the hand's length takes the thumb to the palm)
  // (in its own measures: the knuckles 1.2 cm short of its middle; the thumb what stands out past 2.4 cm on its side,
  // from the wrist end to the knuckles, swung about a line along the hand by its root)
  const K = -0.012, R = 0.09 / Math.max(fingers, 1e-3), base = mid.clone().addScaledVector(along, -0.07).addScaledVector(across, 0.025);
  const n = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Quaternion();
  const round = across.clone().multiplyScalar(Math.cos(slant)).addScaledVector(along, Math.sin(slant)); // (the line they close round)
  const out2 = along.clone().multiplyScalar(Math.cos(slant)).addScaledVector(across, -Math.sin(slant)); // (and out from it, across the palm)
  const knuckle = mid.clone().addScaledVector(along, K);
  const sstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // (`zone`: how far across the hand the thumb begins and is wholly thumb, and where along it it gives way to the fingers)
  const thumbAt = (a, t) => sstep(zone[0], zone[1], a) * (1 - sstep(zone[2], zone[3], t));
  const thumbOf = (i) => { at(i, d); return thumbAt(d.dot(across), d.dot(along)); };
  // laying it over: the thumb itself is all of it from its tip back over its surface to 2 cm short of the hand's middle
  // — a line across the hand cut off its end, which reaches on past the knuckles' line, and that end was torn from the
  // rest, its skin stretched eightfold in strips (user, 2026-10-25: "what are those little rectangles") — and its root
  // eased into the palm round it, the weights passed from each point to its neighbours ten times over
  let weightOf = thumbOf;
  if (over) {
    const slot = new Map(ids.map((i, k) => [i, k])), adj = ids.map(() => []), same = new Map(), I = geo.index;
    const key = (i) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
    for (let t = 0; t < I.count; t += 3) {
      const tri = [I.getX(t), I.getX(t + 1), I.getX(t + 2)];
      if (tri.every((i) => slot.has(i))) for (const x of tri) for (const y of tri) if (x !== y) adj[slot.get(x)].push(y);
    }
    for (const i of ids) { const k = key(i); same.set(k, [...(same.get(k) ?? []), i]); } // (points split at a seam: one)
    for (const group of same.values()) for (const x of group) for (const y of group) if (x !== y) adj[slot.get(x)].push(y);
    const co = (i) => { at(i, d); return [d.dot(along), d.dot(across)]; };
    let seed = ids[0];
    for (const i of ids) if (co(i)[1] > co(seed)[1]) seed = i;
    const own = new Set([seed]), todo = [seed];
    while (todo.length) for (const y of adj[slot.get(todo.pop())]) { const [t, a] = co(y); if (!own.has(y) && t > -0.02 && a > 0.012) { own.add(y); todo.push(y); } }
    // (and none of it at the wrist, where the hand's own points end: turned there, the skin tore from the forearm's)
    const w = Float32Array.from(ids, (i) => (own.has(i) ? 1 : thumbOf(i) * sstep(-0.075, -0.045, co(i)[0])));
    for (let pass = 0; pass < (over[4] ?? 10); pass++) {
      const was = w.slice();
      ids.forEach((i, k) => {
        // (the thumb itself wholly, from 1 cm short of the knuckles' line out; at its root, the ball of the thumb eased
        // into the palm with the rest: held at 1 there too, the skin stretched threefold at its edge)
        if ((own.has(i) && co(i)[0] > -0.01) || (!own.has(i) && co(i)[0] > K) || co(i)[0] < -0.06 || !adj[k].length) return; // (the fingers keep none of it)
        w[k] = 0.5 * was[k] + (0.5 * adj[k].reduce((sum, y) => sum + was[slot.get(y)], 0)) / adj[k].length;
      });
    }
    // (a point the model splits in two at a seam of its picture moves as one: its halves had come by different weights
    // from their different neighbours, and the skin opened between them in dark lines)
    for (const group of same.values()) { const mean = group.reduce((sum, i) => sum + w[slot.get(i)], 0) / group.length; for (const i of group) w[slot.get(i)] = mean; }
    weightOf = (i) => w[slot.get(i)];
  }
  // (`handle`: the fingers closed round it each on its own, wrapFingers, in place of the curl round one line)
  const grip = handle && wrapFingers(P, ids, { along, across, palm, mid, toPalm: towardPalm }, (i) => weightOf(i) > 0.5, { slant, roll, part, ...handle });
  // `over` ([along it, past its middle, up], m; and how far the end hooks down, rad): the thumb laid over the top of
  // what the fingers close round — the thumb's side of it, up as a knife is held — its tip just down its far side by the
  // fingers, as a fist holds a handle (user, 2026-10-25: swung in round the hand's length only, it stood up off the
  // handle, 4–5 cm, on the near side). Else swung in by `thumb`.
  let aimT = null, hook = null, reach = 0;
  if (over) {
    let tip = null;
    for (const i of ids) if (weightOf(i) > 0.9) { const p = v.fromBufferAttribute(P, i); if (!tip || p.distanceTo(base) > tip.distanceTo(base)) tip = p.clone(); }
    const way = grip ? grip.way : round, up = new THREE.Vector3().crossVectors(way, palm).normalize();
    if (up.dot(across) < 0) up.negate();
    const to = (grip ? grip.centre.clone() : knuckle.clone().addScaledVector(palm, R)).addScaledVector(way, over[0]).addScaledVector(palm, over[1]).addScaledVector(up, over[2]);
    reach = tip.distanceTo(base);
    const dir = to.sub(base).normalize();
    aimT = new THREE.Quaternion().setFromUnitVectors(tip.sub(base).normalize(), dir);
    const toward = up.negate().addScaledVector(dir, -up.dot(dir)).normalize(); // (down: what it curls towards)
    hook = { dir, toward, axis: dir.clone().cross(toward).normalize(), from: 0.45 * reach, R: (0.55 * reach) / over[3] };
  }
  ids.forEach((i, slot) => {
    at(i, d);
    const h = d.dot(palm);
    n.fromBufferAttribute(N, i);
    const onThumb = weightOf(i);
    // where the fingers' curl takes it, and where the thumb's turn does: as much of the second as it is thumb (taken
    // wholly by the turn if at all thumb, a point a hair into the thumb's edge jumped out of the curl, and the skin
    // tore along the line where the two met)
    const curled = v.fromBufferAttribute(P, i).clone(), bentN = n.clone();
    const e = d.clone().addScaledVector(along, -K), s = e.dot(out2);
    if (grip) grip.place(slot, curled, bentN);
    else if (s > 0) {
      const phi = s / R, cos = Math.cos(phi), sin = Math.sin(phi);
      // bent round a line R off the knuckles on the palm's side: the length out from it goes round the arc
      curled.copy(knuckle).addScaledVector(round, e.dot(round)).addScaledVector(palm, R).addScaledVector(palm, (h - R) * cos).addScaledVector(out2, -(h - R) * sin);
      const na = n.dot(out2), nh = n.dot(palm), nc = n.dot(round);
      bentN.set(0, 0, 0).addScaledVector(out2, na * cos + nh * -sin).addScaledVector(palm, na * sin + nh * cos).addScaledVector(round, nc);
    }
    if (onThumb > 0) {
      if (aimT) q.identity().slerp(aimT, onThumb * part ** late);
      else q.setFromAxisAngle(along, towardPalm * thumb * onThumb);
      const p = v.fromBufferAttribute(P, i).sub(base).applyQuaternion(q);
      if (hook) {
        // its far half curled down round onto the far side, bent along an arc as the fingers are (bent at one place, it
        // broke into facets there: user, 2026-10-25)
        const s = p.dot(hook.dir) - hook.from, hb = p.dot(hook.toward);
        if (s > 0) {
          const phi = (s / hook.R) * onThumb * part ** late, R = hook.R;
          p.addScaledVector(hook.dir, -(s + hook.from)).addScaledVector(hook.toward, -hb) // (what is left: across the thumb)
            .addScaledVector(hook.dir, hook.from + (R - hb) * Math.sin(phi)).addScaledVector(hook.toward, R - (R - hb) * Math.cos(phi));
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(hook.axis, phi));
        }
      }
      p.add(base);
      curled.lerp(p, onThumb);
      bentN.lerp(n.applyQuaternion(q), onThumb).normalize();
    }
    P.setXYZ(i, curled.x, curled.y, curled.z);
    N.setXYZ(i, bentN.x, bentN.y, bentN.z);
  });
  P.needsUpdate = N.needsUpdate = true;
  // (and where its middle is from the wrist, in those axes: the bone's own place as modelled, the model at rest)
  const wrist = bones[held[0]].getWorldPosition(new THREE.Vector3()), off = mid.clone().sub(wrist);
  const hollow = (grip ? grip.centre.clone() : knuckle.clone().addScaledVector(palm, R)).sub(wrist);
  return { along, across, palm, mid: [off.dot(along), off.dot(across), off.dot(palm)], hollow: [hollow.dot(along), hollow.dot(across), hollow.dot(palm)], round: grip ? grip.way : round };
}

/** Turn `bone` so that `child` lies towards `target`, then `roll` it about that line. */
function aim(bone, child, target, roll = 0) {
  bone.updateWorldMatrix(true, true);
  const at = bone.getWorldPosition(new THREE.Vector3());
  const from = child.getWorldPosition(new THREE.Vector3()).sub(at).normalize(), to = target.clone().sub(at).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(from, to).premultiply(new THREE.Quaternion().setFromAxisAngle(to, roll));
  const up = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(up.multiply(turn.multiply(bone.getWorldQuaternion(new THREE.Quaternion()))));
  bone.updateWorldMatrix(false, true);
}

/** `cur` eased towards `to`, critically damped (`v`: its speed, kept between frames): no jolt at the start, no overshoot. */
function ease(cur, to, v, time, max, dt) {
  const w = 2 / time, x = w * dt, k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = THREE.MathUtils.clamp(cur - to, -max * time, max * time), goal = cur - change;
  const t = (v.v + w * change) * dt;
  v.v = (v.v - w * t) * k;
  let out = goal + (change + t) * k;
  if (to - cur > 0 === out > to) { out = to; v.v = 0; }
  return out;
}

/**
 * Mum, standing on the floor of `g` at `x, z`, facing the point `look` ([x, z]); `sees(eye)`: whether you are where
 * she could see you at all (the room she is in). What she takes up of the floor (in your way and Luna's) is there at
 * once; the figure comes in once it has loaded. `board`: the chopping board she goes to now and then ({ board, knife,
 * top }, house.js); `moved()`: asks for the kitchen lamp's shadow to be drawn again; `renderer`: the game's, to picture
 * her face round her eyes once (EYES). Returns a promise of her.
 */
export function mother(g, ctx, x, z, look, sees, { board = null, moved = () => {}, renderer } = {}) {
  const yaw = Math.atan2(look[0] - x, look[1] - z);
  // her footprint, elbows and all: 0.5 wide, from 0.16 behind her to 0.26 in front, turned as she is (and kept so as
  // she goes about)
  const col = { type: 'box', x0: 0, x1: 0, z0: 0, z1: 0, top: 1.7 };
  const footprint = (px, pz, a) => {
    const c = Math.cos(a), s = Math.sin(a), xs = [], zs = [];
    for (const [u, w] of [[-0.25, -0.16], [0.25, -0.16], [-0.25, 0.26], [0.25, 0.26]]) { xs.push(px + u * c + w * s); zs.push(pz - u * s + w * c); }
    Object.assign(col, { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
  };
  footprint(x, z, yaw);
  ctx.colliders.push(col);
  return new GLTFLoader().loadAsync('assets/models/mother.glb').then(({ scene: her, animations }) => {
    const bones = {};
    let body = null;
    her.traverse((o) => {
      if (o.isBone) bones[o.name.replace('mixamorig', '')] = o;
      if (o.isSkinnedMesh) body = o;
    });
    her.updateMatrixWorld(true);
    const hand = GRIP && curlHand(body.geometry, body.skeleton.bones, GRIP), handRest = bones.LeftHand.getWorldQuaternion(new THREE.Quaternion());
    // her hands as modelled, for laying them as she works: the left as it is; the right can close into a fist round the
    // knife — more shapes of her (morph targets): a third closed, two thirds, all, gone through one after the other as
    // she takes it up, and back as she lets go (straight over from open to closed, the fingertips cut across the handle)
    const hands = { Left: { ...curlHand(body.geometry, body.skeleton.bones, { fingers: 0, thumb: 0 }, 'Left', new THREE.Vector3(0, 0, 1)), rest: handRest.clone() } };
    {
      const G = body.geometry, P = G.attributes.position, N = G.attributes.normal, p0 = P.array.slice(), n0 = N.array.slice();
      const shapes = FIST_STAGES.map((part) => {
        hands.Right = { ...curlHand(G, body.skeleton.bones, { ...FIST, part }, 'Right', new THREE.Vector3(0, 0, 1)), rest: bones.RightHand.getWorldQuaternion(new THREE.Quaternion()) };
        const dp = P.array.map((v, i) => v - p0[i]), dn = N.array.map((v, i) => v - n0[i]);
        P.array.set(p0);
        N.array.set(n0);
        return [new THREE.BufferAttribute(dp, 3), new THREE.BufferAttribute(dn, 3)];
      });
      G.morphAttributes.position = shapes.map((s) => s[0]);
      G.morphAttributes.normal = shapes.map((s) => s[1]);
      G.morphTargetsRelative = true;
      body.updateMorphTargets();
    }
    for (const [side, f] of Object.entries(FOLD)) {
      const shoulder = bones[side + 'Shoulder'];
      shoulder.updateWorldMatrix(true, false);
      const round = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side === 'Left' ? -1 : 1) * f.shoulder).multiply(shoulder.getWorldQuaternion(new THREE.Quaternion()));
      shoulder.quaternion.copy(shoulder.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(round));
      aim(bones[side + 'Arm'], bones[side + 'ForeArm'], new THREE.Vector3(...f.elbow));
      aim(bones[side + 'ForeArm'], bones[side + 'Hand'], new THREE.Vector3(...f.wrist), f.roll);
      if (f.tip) aim(bones[side + 'Hand'], bones[side + 'HandMiddle4'], new THREE.Vector3(...f.tip), f.hand);
      else {
        // the left hand laid as asked: its length to her right, its thumb back towards her, its palm down, then turned
        // by `orient` (her y, z, x) — the hand's own axes as modelled taken onto those
        const laid = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...f.orient, 'YZX'))
          .multiply(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)))
          .multiply(new THREE.Matrix4().makeBasis(hand.along, hand.across, hand.palm).transpose());
        const b = bones[side + 'Hand'], q = new THREE.Quaternion().setFromRotationMatrix(laid).multiply(handRest);
        b.updateWorldMatrix(true, false);
        b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
        b.updateWorldMatrix(false, true);
      }
    }
    // lit as everything else in the house is: its own material had no shine at all, not even on her eyes
    const was = body.material, breathing = { value: 0 };
    // (both faces: its collar, its apron's edges and hem are single sheets, and from the side, or with her head
    // turned, there were slits through them onto whatever was behind her)
    // (not its metalness picture: nothing on her is metal, and the shader had no room left for the eyes' — sixteen pictures
    // at most, and the house's shadows take half)
    body.material = new THREE.MeshStandardMaterial({ map: was.map, roughnessMap: was.roughnessMap, side: THREE.DoubleSide });
    was.dispose();
    const skin = skinOf(body.geometry, body.material.map.image, body.skeleton.bones);
    mendSpecks(body.geometry, skin);
    body.geometry.setAttribute('aSkin', new THREE.BufferAttribute(skin, 1));
    // her eyes (EYES): her face round them pictured once from in front, as modelled, so that the painted whites, lids and
    // lashes can be read from where they are on her as the eyes turn and the lids come down
    const [ex, ey, ew, eh] = EYE_BOX, eyeTarget = new THREE.WebGLRenderTarget(1024, 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    {
      const flat = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ map: body.material.map })), front = new THREE.Scene().add(flat);
      const cam = new THREE.OrthographicCamera(ex, ex + ew, ey + eh, ey, 0.5, 1.5), prior = renderer.getRenderTarget(), clears = renderer.autoClear;
      cam.position.z = 1;
      const iris = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: irisTex() })), card = new THREE.Scene().add(iris);
      renderer.setRenderTarget(eyeTarget);
      renderer.clear();
      renderer.autoClear = false; // (else the iris, drawn second, wiped the face off)
      eyeTarget.viewport.set(0, 0, 1024, 320);
      renderer.setRenderTarget(eyeTarget);
      renderer.render(front, cam);
      eyeTarget.viewport.set(0, 320, 192, 192);
      renderer.setRenderTarget(eyeTarget);
      cam.position.set(0, 0, 1);
      cam.left = cam.bottom = -1;
      cam.right = cam.top = 1;
      cam.updateProjectionMatrix();
      renderer.render(card, cam);
      eyeTarget.viewport.set(0, 0, 1024, 512);
      renderer.setRenderTarget(prior);
      renderer.autoClear = clears;
      flat.material.dispose();
      iris.material.map.dispose();
      iris.material.dispose();
      iris.geometry.dispose();
    }
    const lid = { value: 0 }, gazes = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)];
    const eyeUniforms = { uEyeTex: { value: eyeTarget.texture }, uEyeBox: { value: new THREE.Vector4(ex, ey, 1 / ew, 0.625 / eh) }, uGaze: { value: gazes }, uLid: lid };
    // the breath swells her chest, out from the middle of her and a little up, most in front and under the
    // collarbones, less at the bust and belly, none at the neck or hips; by where a point is on her as modelled
    // (arms held out from her sides): so not the arms, and the apron and the dress under it go out together
    // (going by which bone holds a point, as it first did, the two could go out by different amounts). And her
    // skin through a cool filter (SKIN), the clothes and hair as they are
    body.material.onBeforeCompile = (sh) => {
      sh.uniforms.uBreath = breathing;
      sh.vertexShader = 'uniform float uBreath;\nattribute float aSkin;\nvarying float vSkin;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	vSkin = aSkin;
	{
		float y = position.y, rise = smoothstep( 0.92, 1.25, y ) * ( 1.0 - smoothstep( 1.3, 1.44, y ) ) * ( 1.0 - smoothstep( 0.15, 0.2, abs( position.x ) ) );
		vec3 away = normalize( vec3( position.x, 0.0, position.z + 0.015 ) + vec3( 0.0, 0.0, 1e-4 ) ); // (as modelled: skinned after)
		transformed += ( away + vec3( 0.0, 0.3, 0.0 ) ) * uBreath * ${BREATH.swell} * rise * ( 0.35 + 0.65 * max( away.z, 0.0 ) );
	}`);
      Object.assign(sh.uniforms, eyeUniforms);
      sh.vertexShader = sh.vertexShader.replace('vSkin = aSkin;', 'vSkin = aSkin;\n\tvBind = position;').replace('varying float vSkin;', 'varying float vSkin;\nvarying vec3 vBind;');
      sh.fragmentShader = 'varying float vSkin;\n' + EYE_HEAD + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
${EYE_MAIN}
	{
		vec3 cool = diffuseColor.rgb * vec3( ${SKIN.filter.map((v) => v.toFixed(3)).join(', ')} );
		cool *= dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / max( dot( cool, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 ); // (as light as it was)
		diffuseColor.rgb = mix( diffuseColor.rgb, cool, ${SKIN.density.toFixed(3)} * vSkin );
	}`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
	roughnessFactor = mix( roughnessFactor, 0.3, eyeWet ); // (wet)`);
    };
    body.castShadow = body.receiveShadow = true;
    // the house's shadows are drawn once and kept, and she moves: her head in them is a plain ball, smaller than it
    // (7.5 cm; the face is 10–12 cm out from its middle) — as itself, its nose and hair laid a ragged shadow across
    // her face that came and went as she turned to look at you (user, 2026-10-23). The rest of her is as she is:
    // made 2.5 cm thinner in them (so as not to stand in her own shadow as she breathed), her apron and skirt, single
    // sheets, came apart and her shadow on the floor was full of holes and loose bits (user, 2026-10-23); her
    // breath moves her less than the lamp's shadow's own margin (4.5–6 mm against about a centimetre; she isn't in the sun's), so she doesn't
    const skull = new THREE.Box3(), pt = new THREE.Vector3(), P = body.geometry.attributes.position;
    const headBones = ['Head', 'HeadTop_End'].map((n) => body.skeleton.bones.indexOf(bones[n])).concat(body.skeleton.bones.findIndex((b) => b.name === 'headfront'));
    const SI = body.geometry.attributes.skinIndex, SW = body.geometry.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      let w = 0, b = 0;
      for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > w) { w = SW.getComponent(i, k); b = SI.getComponent(i, k); }
      if (headBones.includes(b)) skull.expandByPoint(pt.fromBufferAttribute(P, i));
    }
    const head = { value: new THREE.Vector4(...headBones, body.skeleton.bones.indexOf(bones.Neck)) }, middle = { value: skull.getCenter(new THREE.Vector3()) };
    const shadowOf = (m) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uHead = head;
        sh.uniforms.uSkull = middle;
        sh.vertexShader = 'uniform vec4 uHead;\nuniform vec3 uSkull;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	{
		float onHead = 0.0; // (the neck half)
		for ( int k = 0; k < 4; k ++ ) {
			float b = skinIndex[ k ];
			if ( abs( b - uHead.x ) < 0.5 || abs( b - uHead.y ) < 0.5 || abs( b - uHead.z ) < 0.5 ) onHead += skinWeight[ k ];
			else if ( abs( b - uHead.w ) < 0.5 ) onHead += 0.5 * skinWeight[ k ];
		}
		vec3 ball = uSkull + normalize( transformed - uSkull + vec3( 0.0, 1e-4, 0.0 ) ) * 0.075;
		transformed = mix( transformed, ball, clamp( onHead, 0.0, 1.0 ) );
	}`);
      };
      return m;
    };
    body.customDistanceMaterial = shadowOf(new THREE.MeshDistanceMaterial());
    // (and none in the sun's and the sky's, drawn once for the whole house: she walks about now, and would leave her
    // shadow behind her there; the kitchen lamp's is drawn again as she goes — `moved`)
    const none = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    none.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n\tdiscard;'); };
    body.customDepthMaterial = none;
    // ---- alive: every frame her pose is set afresh, bone by bone — arms folded, walking, or at the chopping board, or
    // on the way from one to another — and on top of that go her head, her breath and, as she works, her hands. (Not
    // with three's AnimationMixer: it writes a bone only when what it has for it changes, so on a pose held still the
    // turns of her head were added up frame on frame, and her neck went round and round.)
    const r = mulberry32(1958), span = ([a, b]) => a + r() * (b - a), V = THREE.Vector3, Q = THREE.Quaternion;
    const all = [...new Set(Object.values(bones))];
    /** Her pose as it is now. */
    const still = () => all.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
    const folded = still();
    const frame = new Q(), unframe = new Q();
    const framed = () => { her.updateWorldMatrix(true, false); her.getWorldQuaternion(frame); unframe.copy(frame).invert(); };
    framed();
    const q = new Q(), e = new THREE.Euler(0, 0, 0, 'YXZ'), at = new V(), d = new V(), up = new Q();
    /** Turn `bone` by pitch, yaw, roll about her own axes (not the bone's, which are whatever the rig made them). */
    const turn = (bone, pitch, yaw, roll) => {
      bone.updateWorldMatrix(true, false);
      q.setFromEuler(e.set(pitch, yaw, roll)).premultiply(frame).multiply(unframe).multiply(bone.getWorldQuaternion(up));
      bone.quaternion.copy(bone.parent.getWorldQuaternion(up).invert().multiply(q));
    };
    /** Her arm on `side` reaching its wrist to `target` (world), the elbow bent out towards `pole`. */
    const reach = (side, target, pole) => {
      const arm = bones[side + 'Arm'], fore = bones[side + 'ForeArm'], hand = bones[side + 'Hand'];
      arm.updateWorldMatrix(true, true);
      const S = arm.getWorldPosition(new V()), E = fore.getWorldPosition(new V()), a = S.distanceTo(E), b = E.distanceTo(hand.getWorldPosition(new V()));
      const n = target.clone().sub(S), dist = THREE.MathUtils.clamp(n.length(), Math.abs(a - b) + 0.01, a + b - 0.002);
      n.normalize();
      const x0 = (a * a - b * b + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, a * a - x0 * x0));
      const p = pole.clone().sub(S);
      p.addScaledVector(n, -p.dot(n)).normalize();
      aim(arm, fore, S.clone().addScaledVector(n, x0).addScaledVector(p, h));
      aim(fore, hand, S.clone().addScaledVector(n, dist));
    };
    /**
     * Her hand on `side` turned (world) so its palm faces `palm` and either its length lies along `along` or its thumb's
     * side along `across`: its axes then, and its turn (world) from as it was modelled.
     */
    const lie = (side, { along, across, palm }) => {
      const h = hands[side], sgn = Math.sign(new V().crossVectors(h.along, h.across).dot(h.palm)), P = palm.clone().normalize();
      let A, C;
      if (along) { A = along.clone().addScaledVector(P, -along.dot(P)).normalize(); C = sgn > 0 ? new V().crossVectors(P, A) : new V().crossVectors(A, P); }
      else { C = across.clone().addScaledVector(P, -across.dot(P)).normalize(); A = sgn > 0 ? new V().crossVectors(C, P) : new V().crossVectors(P, C); }
      const R = new THREE.Matrix4().makeBasis(A, C, P).multiply(new THREE.Matrix4().makeBasis(h.along, h.across, h.palm).transpose());
      return { A, C, P, q: new Q().setFromRotationMatrix(R).multiply(h.rest) };
    };
    /**
     * Her hand on `side` turned to `qw` (world). Most of the turn about the forearm's own line goes into the forearm,
     * as it does in an arm (the hand has no bones of its own to take it): all of it at the wrist wrung the skin there.
     */
    const hold = (side, qw, share = 0.75) => {
      const h = bones[side + 'Hand'], f = h.parent;
      f.updateWorldMatrix(true, true);
      const axis = h.getWorldPosition(new V()).sub(f.getWorldPosition(new V())).normalize();
      const rel = qw.clone().multiply(h.getWorldQuaternion(new Q()).invert());
      let ang = 2 * Math.atan2(axis.x * rel.x + axis.y * rel.y + axis.z * rel.z, rel.w);
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      const fq = new Q().setFromAxisAngle(axis, ang * share).multiply(f.getWorldQuaternion(new Q()));
      f.quaternion.copy(f.parent.getWorldQuaternion(new Q()).invert().multiply(fq));
      f.updateWorldMatrix(false, true);
      h.quaternion.copy(f.getWorldQuaternion(new Q()).invert().multiply(qw));
      h.updateWorldMatrix(false, true);
    };
    /** Where the wrist goes for a point of the hand (`off`: in its axes, from the wrist) to be at `p`, the hand lying as `t`. */
    const wristFor = (p, t, off) => p.clone().addScaledVector(t.A, -off[0]).addScaledVector(t.C, -off[1]).addScaledVector(t.P, -off[2]);
    /** Where her elbow on `side` bends out to: out to that side, back, down. */
    const pole = (side) => {
      const left = new V(1, 0, 0).applyQuaternion(frame), fwd = new V(0, 0, 1).applyQuaternion(frame);
      return bones[side + 'Arm'].getWorldPosition(new V()).addScaledVector(left, side === 'Left' ? 0.35 : -0.35).addScaledVector(fwd, -0.25).add(new V(0, -0.3, 0));
    };

    // the knife in her right hand: the fist round the middle of its handle, the handle crossing her palm as FIST has it
    // (on the knife: x along the blade to its tip, y off its face, z towards its back; the edge is at −z), her palm to its
    // +y face. `inHand`: her hand's turn and wrist with the knife as it is made (at the origin, unturned)
    const HANDLE = new V(-0.078, 0.008, -0.014), EDGE = new V(0.16, 0.008, -0.0355); // (where it is held — back along the handle: further on, her forefinger came through the blade's heel; where it cuts)
    const inHand = lie('Right', { across: new V(Math.cos(FIST.slant), Math.sin(FIST.slant) * Math.sin(FIST.roll), Math.sin(FIST.slant) * Math.cos(FIST.roll)), palm: new V(0, Math.cos(FIST.roll), -Math.sin(FIST.roll)) });
    inHand.wrist = wristFor(HANDLE, inHand, hands.Right.hollow);
    const handOn = (kp, kq) => ({ q: kq.clone().multiply(inHand.q), wrist: kp.clone().add(inHand.wrist.clone().applyQuaternion(kq)) });
    const knifeIn = (wrist, hq) => { const kq = hq.clone().multiply(inHand.q.clone().invert()); return { q: kq, p: wrist.clone().sub(inHand.wrist.clone().applyQuaternion(kq)) }; };

    // the board, the knife lying on it, the carrot
    const B = board?.board, knife = board?.knife, TH = board?.top ?? 0.02;
    const counter = B ? B.getWorldPosition(new V()).y : 0.92;

    const face = new V(0, 0, 1).applyQuaternion(bones.Head.getWorldQuaternion(new Q()).invert()); // (the way her face looks, on the head bone)
    // at the board: leaning in a little, her hands resting on the worktop in front of it (as modelled here, at the
    // origin; her hands as she works come after, over this)
    turn(bones.Spine, 0.16, 0, 0);
    turn(bones.Spine1, 0.08, 0, 0);
    const HANDS_ON = { Right: { at: [-0.13, counter + 0.03, 0.22], along: [0.15, 0.02, 0.98] }, Left: { at: [0.12, counter + 0.03, 0.23], along: [-0.15, 0.02, 0.98] } };
    for (const side of ['Right', 'Left']) {
      const t = lie(side, { along: new V(...HANDS_ON[side].along), palm: new V(0, -1, 0) });
      reach(side, wristFor(new V(...HANDS_ON[side].at), t, hands[side].mid), pole(side));
      hold(side, t.q);
    }
    const bent = still();
    all.forEach((b, i) => { b.quaternion.copy(folded[i].q); b.position.copy(folded[i].p); });
    her.updateMatrixWorld(true);

    her.position.set(x, 0, z);
    her.rotation.y = yaw;
    g.add(her);
    her.updateMatrixWorld(true);
    body.computeBoundingSphere(); // (as she stands now, not as she was modelled: arms out, she would be culled wrongly)
    body.boundingSphere.radius += 0.6; // (and she bends, and reaches)
    framed();

    // the model's walk, read off its tracks (bones it leaves out keep the arms-folded pose; its scaling left out)
    const walkClip = animations.find((a) => a.name === 'Walking'), named = new Map(all.map((b, i) => [b.name, i]));
    const walkTracks = walkClip.tracks.map((tr) => { const dot = tr.name.lastIndexOf('.'); return { i: named.get(tr.name.slice(0, dot)), prop: tr.name.slice(dot + 1), f: tr.createInterpolant() }; })
      .filter((w) => w.i !== undefined && (w.prop === 'quaternion' || w.prop === 'position'));
    const walking = all.map(() => ({ q: new Q(), p: new V() }));
    let walkT = 0, wWalk = 0, wBent = 0, stride = 0;
    const weight = { fold: 1, walk: 0, work: 0 }, wv = { walk: { v: 0 }, bent: { v: 0 } };
    /**
     * Her pose this frame: how far into the walk (`walkTo`) and how far bent over the board (`bentTo`, else her arms
     * folded) she means to be, eased there — no step from one to the next starts on its own; the walk run on by
     * `stride` (its own time: forward as far as her feet go, back for a step back).
     */
    const blend = (dt, walkTo, bentTo) => {
      wWalk = ease(wWalk, walkTo, wv.walk, 0.22, 20, dt);
      wBent = ease(wBent, bentTo, wv.bent, 0.3, 20, dt);
      Object.assign(weight, { walk: wWalk, work: (1 - wWalk) * wBent, fold: (1 - wWalk) * (1 - wBent) });
      const D = walkClip.duration;
      walkT = (((walkT + stride) % D) + D) % D;
      if (wWalk > 1e-3) {
        walking.forEach((w, i) => { w.q.copy(folded[i].q); w.p.copy(folded[i].p); });
        for (const t of walkTracks) { const v = t.f.evaluate(walkT); if (t.prop === 'quaternion') walking[t.i].q.fromArray(v); else walking[t.i].p.fromArray(v); }
      }
      all.forEach((b, i) => {
        b.quaternion.copy(folded[i].q).slerp(bent[i].q, wBent);
        b.position.copy(folded[i].p).lerp(bent[i].p, wBent);
        if (wWalk > 1e-3) { b.quaternion.slerp(walking[i].q, wWalk); b.position.lerp(walking[i].p, wWalk); }
      });
    };

    const shoulders = ['LeftShoulder', 'RightShoulder'].map((n) => bones[n]);
    const lift = new V(...BREATH.lift), m3 = new THREE.Matrix3(), dl = new V();
    // the breath: in (two fifths of it), out (half), and a pause before the next
    let phase = 0, every = span(BREATH.every), depth = span(BREATH.depth);
    const breath = (dt) => {
      if ((phase += dt / every) >= 1) { phase -= 1; every = span(BREATH.every); depth = span(BREATH.depth); }
      return depth * (phase < 0.4 ? 0.5 - 0.5 * Math.cos((Math.PI * phase) / 0.4) : phase < 0.9 ? 0.5 + 0.5 * Math.cos((Math.PI * (phase - 0.4)) / 0.5) : 0);
    };
    // the head: where it points (`now`), where she means it to (`goal`), whether she is watching you; or, about her
    // errand, ahead of her (`task` 'ahead') or at what her hands are doing (a point)
    const now = { ...REST }, goal = { ...REST }, v = { yaw: { v: 0 }, pitch: { v: 0 } };
    let watching = false, wait = 0, stale = 0, beyond = 0;
    const angleOf = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const lookStep = (time, dt, task, pace = '') => {
      const head = bones.Head.getWorldPosition(at);
      head.y += 0.1; // (her eyes a hand over the bone's root)
      let want = REST;
      if (task === null) {
        const eye = ctx.camera.position;
        d.copy(eye).sub(head).applyQuaternion(unframe);
        const away = Math.atan2(d.x, d.z), there = sees(eye);
        if (watching ? !there || Math.abs(away) > LOOK.lose : there && Math.abs(away) < LOOK.find) {
          // you have come into sight, or gone out of it: a moment, and then she turns
          if (wait <= 0) wait = span(watching ? LOOK.letGo : LOOK.react);
          if ((wait -= dt) <= 0) { watching = !watching; wait = 0; }
        } else wait = 0;
        if (watching) want = { yaw: THREE.MathUtils.clamp(away, -LOOK.reach, LOOK.reach), pitch: THREE.MathUtils.clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), LOOK.up, LOOK.down) };
      } else {
        watching = false;
        wait = 0;
        if (task !== 'ahead') {
          // (bent over the board she already looks down at it: the head turns on from where that leaves it)
          d.copy(task).sub(head).applyQuaternion(unframe);
          const f = face.clone().applyQuaternion(bones.Head.getWorldQuaternion(new Q())).applyQuaternion(unframe);
          want = { yaw: Math.atan2(d.x, d.z) - Math.atan2(f.x, f.z), pitch: Math.atan2(-d.y, Math.hypot(d.x, d.z)) - Math.atan2(-f.y, Math.hypot(f.x, f.z)) };
          want = { yaw: THREE.MathUtils.clamp(angleOf(want.yaw), -LOOK.reach, LOOK.reach), pitch: THREE.MathUtils.clamp(want.pitch, LOOK.up, LOOK.down + 0.3) }; // (as far as a neck turns)
        }
      }
      // she goes after you only once you are a little way off where she looks (or have stood a while just off it), and
      // a moment after her eyes have (but at once when you are far off it)
      const off = Math.hypot(want.yaw - goal.yaw, want.pitch - goal.pitch);
      stale = off > deg(1.2) ? stale + dt : 0;
      beyond = off > LOOK.slack ? beyond + dt : 0;
      if (beyond > LOOK.lag || off > deg(25) || stale > 0.7 || !watching) { goal.yaw = want.yaw; goal.pitch = want.pitch; stale = beyond = 0; }
      const [lag, fast] = pace === 'snap' ? LOOKS.snap : pace === 'slow' ? [LOOKS.ease, LOOKS.speed] : [LOOK.ease, LOOK.speed];
      now.yaw = ease(now.yaw, goal.yaw, v.yaw, lag, fast, dt);
      now.pitch = ease(now.pitch, goal.pitch, v.pitch, lag * 0.85, fast, dt);
      // and never quite still: a head held up sways a little
      return { yaw: now.yaw + 0.005 * Math.sin(time * 0.37 + 1) + 0.003 * Math.sin(time * 0.91), pitch: now.pitch + 0.004 * Math.sin(time * 0.53 + 2) };
    };

    // ---- her eyes (EYES, GAZE, BLINK): where they point, out in the room (so a turn of her head doesn't take them off
    // what they are on), what they are on, how they get there; and her lids. Their own dice: drawn from hers, every
    // draw after them in her errand would go another way
    const er = mulberry32(2810), espan = ([a, b]) => a + er() * (b - a);
    const headIx = body.skeleton.bones.indexOf(bones.Head), headM = new THREE.Matrix4(), headInv = new THREE.Matrix4();
    const balls = EYES.at.map(([ax, ay, az]) => new V(ax, ay, az - EYES.ball * 0.0009)), ballsMid = balls[0].clone().lerp(balls[1], 0.5);
    const gaze = { dir: null, jump: null, late: 0, wait: espan(GAZE.late), still: espan(GAZE.still) };
    const blink = { t: -1, next: 1.2, more: 0 };
    const leap = (to, amp) => {
      // (over in 20–80 ms, the further the longer, as eyes go; a big one often with a blink)
      gaze.jump = { from: gaze.dir.clone(), to: to.clone(), t: 0, T: 0.021 + 0.0022 * THREE.MathUtils.radToDeg(amp) };
      gaze.late = 0;
      gaze.wait = espan(GAZE.late);
      if (amp > BLINK.big && blink.t < 0 && er() < BLINK.withJump) blink.t = 0;
    };
    const ahead = new V(), mid = new V(), aim2 = new V(), fixed = new V(), jit = new Q();
    /** Her eyes on `target` (a point, or null: straight out of her face), and her lids, this frame. */
    const eyesStep = (dt, target) => {
      bones.Head.updateWorldMatrix(true, false);
      headM.multiplyMatrices(bones.Head.matrixWorld, body.skeleton.boneInverses[headIx]);
      headInv.copy(headM).invert();
      mid.copy(ballsMid).applyMatrix4(headM);
      ahead.set(0, -0.07, 1).transformDirection(headM);
      const want = target ? aim2.copy(target).sub(mid).normalize() : ahead, far = target ? Math.max(0.3, target.distanceTo(mid)) : 3;
      if (!gaze.dir) gaze.dir = want.clone();
      const off = gaze.dir.angleTo(want);
      if (gaze.jump) {
        const j = gaze.jump, k = (j.t = Math.min(1, j.t + dt / j.T)) ** 3 * (10 - 15 * j.t + 6 * j.t * j.t);
        gaze.dir.copy(j.from).lerp(j.to, k).normalize();
        if (j.t >= 1) gaze.jump = null;
      } else if (off > GAZE.jump) {
        if ((gaze.late += dt) > gaze.wait) leap(want, off);
      } else {
        // on it: after it as it moves, and never quite still
        gaze.late = 0;
        gaze.dir.lerp(want, 1 - Math.exp(-7 * dt)).normalize();
        if ((gaze.still -= dt) < 0) {
          gaze.still = espan(GAZE.still);
          const a = er() * Math.PI * 2, axis = new V(Math.cos(a), Math.sin(a), 0).transformDirection(headM);
          leap(want.clone().applyQuaternion(jit.setFromAxisAngle(axis, GAZE.jitter * (0.3 + 0.7 * er()))), GAZE.jitter);
        }
      }
      // into her head, as far as eyes turn; each its own way to the point she looks at (they close in on a near one)
      const fix = fixed.copy(mid).addScaledVector(gaze.dir, far).applyMatrix4(headInv);
      let down = 0;
      balls.forEach((b, i) => {
        const d = fix.clone().sub(b).normalize();
        const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -EYES.turn[0], EYES.turn[0]), pitch = THREE.MathUtils.clamp(Math.asin(d.y), EYES.turn[1], EYES.turn[2]);
        gazes[i].set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        down += pitch / 2;
      });
      // her blinks: one, now and then two or three straight after
      let shut = 0;
      if (blink.t < 0 && (blink.next -= dt) <= 0) blink.t = 0;
      if (blink.t >= 0) {
        const t = (blink.t += dt), { shut: a, hold: h, open: o } = BLINK;
        shut = t < a ? Math.sin((Math.PI / 2) * (t / a)) : t < a + h ? 1 : t < a + h + o ? (1 - (t - a - h) / o) ** 2 : 0;
        if (t >= a + h + o) {
          blink.t = -1;
          if (blink.more > 0) { blink.more--; blink.next = espan([0.06, 0.16]); }
          else {
            blink.next = BLINK.every[0] + (BLINK.every[1] - BLINK.every[0]) * er() ** 1.7;
            const k = er();
            blink.more = k < BLINK.thrice ? 2 : k < BLINK.again ? 1 : 0;
          }
        }
      }
      const lower = EYES.lower * THREE.MathUtils.clamp(down / EYES.turn[1], 0, 1); // (looking down, the lids come down with the eyes)
      lid.value = lower + (1 - lower) * shut;
    };
    // now and then, while she cuts, her eyes come up to you, her head still bent over the board
    let glance = espan(GAZE.glance.every), glancing = 0;
    const eyeAt = new V();
    const glanceUp = (dt, cutting) => {
      if (!cutting) { glancing = 0; return false; }
      if (glancing > 0) return (glancing -= dt) > 0;
      if ((glance -= dt) > 0) return false;
      glance = espan(GAZE.glance.every);
      // (only if you are there to be seen, and not so far round that her eyes can't come your way without her head)
      const d = eyeAt.copy(ctx.camera.position).applyMatrix4(headInv).sub(ballsMid).normalize();
      if (sees(ctx.camera.position) && Math.abs(Math.atan2(d.x, d.z)) < EYES.turn[0] + deg(10)) glancing = espan(GAZE.glance.hold);
      return glancing > 0;
    };

    // ---- the errand: to the chopping board, a few slices off the carrot, the knife put back, home again
    const home = new V(x, 0, z), homeYaw = yaw, upw = new V(0, 1, 0);
    const onBoard = (bx, by, bz) => B.localToWorld(new V(bx, by, bz));
    // the carrot (user, 2026-10-25: "more realistic"): its skin ringed and scarred (textures.js), its cut faces deep
    // orange round a paler core; lying as a carrot lies, on its shoulder and its far end, sloping down to it
    const skinMat = new THREE.MeshStandardMaterial({ map: carrotSkinTex(), roughness: 0.58 }), cutMat = new THREE.MeshStandardMaterial({ map: carrotCutTex(), roughness: 0.32 });
    const Rc = CARROT.r + 0.0016; // (at its shoulder)
    let carrot = null, cutEnd = null, left = CARROT.len, slices = [], fresh = true, tilt = 0;
    /** The middle of the carrot `t` m down it from the crown, on the board (its frame), as it lies now. */
    const axisAt = (t) => new V(CARROT.top + t * Math.cos(tilt), TH + Rc - t * Math.sin(tilt), CARROT.z + carrotBow(t));
    /** How far down the carrot a place `x` along the board is. */
    const tOf = (x) => Math.max(0, (x - CARROT.top) / Math.cos(tilt));
    /** The carrot as long as it is now: its shape, its cut face, and how it lies — the shorter, the less it slopes. */
    const shape = () => {
      carrot.geometry?.dispose();
      carrot.geometry = carrotGeo(left);
      cutEnd.geometry?.dispose();
      cutEnd.geometry = new THREE.CircleGeometry(carrotR(left), 24).rotateY(Math.PI / 2);
      cutEnd.position.set(left, 0, carrotBow(left));
      tilt = Math.atan2(Rc - carrotR(left), left);
      carrot.rotation.z = -tilt;
    };
    /** A whole carrot laid out on the board (what was left of the last one, and its slices, gone). */
    const freshCarrot = () => {
      if (carrot) { B.remove(carrot); carrot.traverse((o) => o.geometry?.dispose()); }
      for (const s of slices) { B.remove(s); s.children[0].geometry.dispose(); }
      slices = [];
      left = CARROT.len;
      fresh = true;
      carrot = new THREE.Mesh(undefined, skinMat);
      cutEnd = new THREE.Mesh(undefined, cutMat);
      carrot.add(cutEnd);
      carrot.position.set(CARROT.top, TH + Rc, CARROT.z);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.011, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5d6a2c, roughness: 0.8 }));
      stalk.position.x = -0.004;
      carrot.add(stalk);
      shape();
      carrot.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.live = true; } });
      B.add(carrot);
    };
    const Bq = new Q(), knifeHome = knife && { p: knife.position.clone(), q: knife.quaternion.clone() };
    let boardYaw = 0, intoB = null;
    if (B) {
      B.updateWorldMatrix(true, true);
      B.getWorldQuaternion(Bq);
      intoB = onBoard(0, 0, -1).sub(onBoard(0, 0, 0)).normalize();
      boardYaw = Math.atan2(intoB.x, intoB.z);
      freshCarrot();
    }
    const knifeAtHome = () => ({ p: B.localToWorld(knifeHome.p.clone()), q: Bq.clone().multiply(knifeHome.q) });
    const putKnife = (p, kq) => { knife.position.copy(B.worldToLocal(p.clone())); knife.quaternion.copy(Bq.clone().invert().multiply(kq)); };
    /**
     * The knife as she cuts with it, its edge at `cx` along the board, `rise` over it, pushed `push` on along its length:
     * the blade along the board away from her, the tip a touch down, the edge down.
     */
    const cutting = (cx, rise, push = 0) => {
      const X = intoB.clone().multiplyScalar(Math.cos(0.06)).addScaledVector(upw, -Math.sin(0.06));
      const Z = upw.clone().addScaledVector(X, -upw.dot(X)).normalize(), Y = new V().crossVectors(Z, X);
      const kq = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      return { p: onBoard(cx, TH + rise, CARROT.z).sub(EDGE.clone().applyQuaternion(kq)).addScaledVector(X, push), q: kq };
    };
    /**
     * The knife's turn `k` of the way from `a` to `b`, by way of lying flat on its face: turned first on its length,
     * then round (the short way straight from held to lying, it came up point first in her hand).
     */
    const turnKnife = (a, b, k, held = b) => {
      const X = new V(1, 0, 0).applyQuaternion(held), flat = [1, -1].map((s) => new Q().setFromAxisAngle(X, (s * Math.PI) / 2).multiply(held))
        .sort((p, q) => new V(0, 1, 0).applyQuaternion(p).y - new V(0, 1, 0).applyQuaternion(q).y)[0];
      return k < 0.5 ? a.clone().slerp(flat, k * 2) : flat.slerp(b, k * 2 - 1);
    };
    const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    /** Minimum jerk: how a hand (or anything a person moves on purpose) goes from rest to rest — slow, quick, slow. */
    const mj = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * t * (10 - 15 * t + 6 * t * t); };

    // ---- how she gets about (user, 2026-10-25: "more human: now it looks split into parts that start one after the
    // other, mechanically"): along a curve from where she stands to where she is going, coming the last of it straight
    // in; she turns towards it as she sets off, and on as she goes, never on a corner; picks up speed and slows to a
    // stop; her feet go as far as she does, and turning on the spot she steps round
    const VMAX = WALK * ERRAND.pace;
    const way = { pts: [], lens: [0], len: 0, s: 0, v: 0, turn: 0 };
    /**
     * A way from where she stands to `to`, the last `lead` m straight in along `arrive` (a Bézier: no corners); `leave`:
     * which way it sets off, as well as towards where it is going (away from the worktop).
     */
    const plan = (to, arrive, lead, leave = null) => {
      const p0 = her.position.clone().setY(0), p3 = to.clone().setY(0), p2 = p3.clone().addScaledVector(arrive, -lead), t0 = p2.clone().sub(p0).normalize();
      if (leave) t0.addScaledVector(leave, 0.9).normalize();
      const p1 = p0.clone().addScaledVector(t0, Math.min(0.6, 0.35 * p0.distanceTo(p2)));
      way.pts = [];
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        way.pts.push(new V().addScaledVector(p0, (1 - u) ** 3).addScaledVector(p1, 3 * u * (1 - u) ** 2).addScaledVector(p2, 3 * u * u * (1 - u)).addScaledVector(p3, u ** 3));
      }
      way.lens = [0];
      for (let i = 1; i < way.pts.length; i++) way.lens.push(way.lens[i - 1] + way.pts[i].distanceTo(way.pts[i - 1]));
      way.len = way.lens.at(-1);
      way.s = way.v = 0;
    };
    /** The point `s` m along the way (past either end, on along the line it ends in). */
    const onWay = (s) => {
      const L = way.lens;
      let i = 1;
      while (i < L.length - 1 && L[i] < s) i++;
      return way.pts[i - 1].clone().lerp(way.pts[i], (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]));
    };
    /** Her heading turned towards `want` as a body turns: no faster than `most` rad/s, and not all at once. */
    const steer = (dt, want, most = 2.4) => {
      way.turn += THREE.MathUtils.clamp(THREE.MathUtils.clamp(angTo(heading, want) * 3.5, -most, most) - way.turn, -7 * dt, 7 * dt);
      heading += way.turn * dt;
      return angTo(heading, want);
    };
    /** You, in her way as she goes. */
    const inWay = () => {
      const p = her.position, eye = ctx.camera.position, ahead = new V(Math.sin(heading), 0, Math.cos(heading)), rel = new V(eye.x - p.x, 0, eye.z - p.z);
      const along = rel.dot(ahead);
      return rel.length() < 0.5 || (along > 0 && along < Math.min(0.8, way.len - way.s + 0.4) && Math.abs(rel.x * ahead.z - rel.z * ahead.x) < 0.4);
    };
    /** One frame along the way: what is left of it. */
    const travel = (dt, stop) => {
      const d = onWay(way.s + 0.35).sub(onWay(way.s + 0.05)), off = steer(dt, Math.atan2(d.x, d.z)), togo = way.len - way.s;
      // as fast as the turn still to make lets her (more than ~75° off, she turns where she stands), the stop ahead, you
      const want = stop ? 0 : Math.min(VMAX * THREE.MathUtils.clamp((Math.cos(off) - 0.25) / 0.65, 0, 1), Math.max(Math.sqrt(2 * 0.5 * togo), 0.07));
      way.v += THREE.MathUtils.clamp(want - way.v, -1.5 * dt, 0.85 * dt);
      const go = Math.min(togo, Math.max(0, way.v) * dt), p = onWay((way.s += go));
      her.position.x = p.x;
      her.position.z = p.z;
      // (her steps shorter as she slows, and so more of them: her feet never slide on the floor)
      stride = go / (WALK * Math.max(wWalk, 0.3)) + Math.abs(way.turn) * dt * 0.4;
      return way.len - way.s;
    };
    /**
     * How far into her walk she is, going as she is: small steps turning on the spot, and (in `step`) shorter ones
     * over the last 0.6 m — her last full stride came down 45 cm ahead of her, in the plinth under the worktop.
     */
    const walkness = () => THREE.MathUtils.clamp(way.v / 0.55 + Math.abs(way.turn) / 6, 0, 1);

    let state = 'stand', clock = 0, met = false, heading = yaw, halted = 0, lean = 0;
    const leanV = { v: 0 };
    const job = { phase: '', t: 0, cuts: 0, done: 0, cutX: 0, knifeX: 0, cut: false, held: false, from: null, wR: 0, wL: 0, fist: 0, P: 1, H: 0.05, H0: 0.05 };
    const homeWay = new V(Math.sin(homeYaw), 0, Math.cos(homeYaw));
    const begin = () => Object.assign(job, { phase: 'reach', t: 0, cuts: Math.round(span(ERRAND.cuts)), done: 0, knifeX: job.cutX, cut: false, held: false, look: -1, since: 0, lift: 0 });

    /** Where she goes this frame, and what her pose goes towards: [walk, bent]. */
    const step = (dt) => {
      stride = 0;
      if (state === 'stand') {
        // the first time 15 s after you first come into the room (user, 2026-10-25); then every so often
        if (!met) {
          if (B && sees(ctx.camera.position)) { met = true; clock = ERRAND.first; }
          return [0, 0];
        }
        if (!B || (clock -= dt) > 0) return [0, 0];
        if (left < 0.03 + ERRAND.slice) {
          // none left to cut: a new one, laid out while you were not there to see; else not this time
          if (sees(ctx.camera.position)) { clock = span(ERRAND.every); return [0, 0]; }
          freshCarrot();
        }
        job.cutX = axisAt(left).x - (fresh ? 0.014 : ERRAND.slice); // (a fresh one: its tip off first)
        // where she stands to cut: the last 0.55 m straight in to it (in at an angle, or turning there, a foot went
        // into the cupboards under the worktop)
        const held = cutting(job.cutX, 0), grip = held.p.clone().add(HANDLE.clone().applyQuaternion(held.q)), h = boardYaw - STANCE.turn;
        job.spot = grip.sub(new V(-STANCE.hand[0], 0, STANCE.hand[1]).applyAxisAngle(upw, h)).setY(0);
        plan(job.spot, intoB, 0.55);
        state = 'toBoard';
      }
      if (state === 'leave') {
        // done: as her hands come off the worktop she steps back from it — a real step, her feet going with her — and
        // already turning the way she will go; then off round to her place, without stopping (she slid back off it at
        // first, her legs hardly moving: user, 2026-10-25; and turned on the spot there, a knee went into the doors)
        // (the model's walk run backwards over one step: from its feet together, the right foot lifted, to that foot
        // down behind — further back, the left foot first swung on forward, into the plinth)
        if (!job.away) walkT = 0.55;
        const k = Math.min(1, (job.away = (job.away ?? 0) + dt) / 0.8);
        her.position.copy(job.spot).addScaledVector(intoB, -0.2 * mj(k));
        const d = home.clone().addScaledVector(homeWay, -0.5).sub(her.position);
        steer(dt, boardYaw + 0.45 * angTo(boardYaw, Math.atan2(d.x, d.z)), 1.2);
        stride = 0.55 - 0.25 * mj(k) - walkT;
        if (k >= 1) {
          job.away = 0;
          plan(home, homeWay, 0.5, intoB.clone().negate());
          state = 'toHome';
        }
        return [0.45, 0];
      }
      if (state === 'toBoard' || state === 'toHome') {
        const stop = inWay(), rest = travel(dt, stop);
        halted = stop && way.v < 0.05 ? halted + dt : 0; // (stopped for you: arms folded, she looks at you)
        if (state === 'toBoard') {
          // her hand already on its way to the knife as she comes up to it, her hands up on the worktop
          if (rest < 0.32 && !job.phase && !stop) begin();
          if (rest < 0.002) state = 'work';
          return [Math.min(walkness(), (rest / 0.6) ** 0.8), halted > 0.5 ? 0 : rest < 0.8 ? 1 : 0];
        }
        if (rest < 0.002) { state = 'settle'; job.t = 0; }
        return [Math.min(walkness(), (rest / 0.6) ** 0.8), 0];
      }
      if (state === 'work') { // at it: settling square to the board
        steer(dt, boardYaw - STANCE.turn);
        stride = Math.abs(way.turn) * dt * 0.4;
        return [Math.abs(way.turn) / 3.5, 1];
      }
      if (state === 'settle') {
        steer(dt, homeYaw);
        if ((job.t += dt) > 0.6) { state = 'stand'; clock = span(ERRAND.every); }
        return [0, 0];
      }
      return [0, 0];
    };

    /** Her hand on `side` resting on the worktop as she stands at the board (as in the pose `bent`, where she is now), or `up` of the way lifted off it and back to her. */
    const onTop = (side, up = 0) => {
      const t = lie(side, { along: new V(...HANDS_ON[side].along).applyQuaternion(frame), palm: new V(0, -1, 0) });
      return { wrist: wristFor(new V(...HANDS_ON[side].at).add(new V(0, 0.035 * up, -0.11 * up)).applyQuaternion(frame).add(her.position), t, hands[side].mid), q: t.q };
    };
    /** Where her elbow on `side` goes for the hand at `wrist`, turned `qw` (world): back along the hand's line, bent ULNAR towards its thumb's side. */
    const elbowFor = (side, wrist, qw) => {
      const h = hands[side], R = qw.clone().multiply(h.rest.clone().invert()), fore = bones[side + 'ForeArm'].getWorldPosition(new V()).distanceTo(bones[side + 'Hand'].getWorldPosition(new V()));
      const line = h.along.clone().applyQuaternion(R).multiplyScalar(Math.cos(ULNAR)).addScaledVector(h.across.clone().applyQuaternion(R), Math.sin(ULNAR)).normalize();
      return wrist.clone().addScaledVector(line, -fore).addScaledVector(new V(1, 0, 0).applyQuaternion(frame), side === 'Right' ? -0.03 : 0.03); // (and a little out from her side)
    };
    /** Her arm on `side` from where her pose left it over to `wrist` and `qw` (world), as far as `w` (the elbow out towards `elbow`). */
    const blendArm = (side, w, wrist, qw, elbow = pole(side)) => {
      if (w <= 0) return;
      // (the hand goes straight over, turning the short way: the arm's joints eased between the two swung it up and
      // over, palm up; only at the very start the joints are eased too, from however her pose had the arm)
      const h = bones[side + 'Hand'], parts = ['Arm', 'ForeArm', 'Hand'].map((n) => bones[side + n]), was = parts.map((b) => b.quaternion.clone());
      reach(side, h.getWorldPosition(new V()).lerp(wrist, w).addScaledVector(upw, 0.03 * Math.sin(Math.PI * w)), elbow); // (lifted a little on the way)
      hold(side, h.getWorldQuaternion(new Q()).slerp(qw, w));
      const k = Math.min(1, w * 3);
      if (k < 1) { parts.forEach((b, i) => b.quaternion.copy(was[i].slerp(b.quaternion, k))); parts[0].updateWorldMatrix(false, true); }
    };
    /**
     * A slice through (user, 2026-10-25: "the pieces have to come apart naturally"): it stands a moment as it was in
     * the carrot, the blade pushes it off along the board, and it tips over away from the knife, faster and faster,
     * onto the board — or, as there come to be more, onto the last ones, lying shingled on them; a little rock as it
     * settles, turned a touch. The tip, longer than it is across, is pushed well aside and just lies. (Each one's
     * outline seen from the side — along the board, up — is kept, for the next to land on.)
     */
    const sliceOff = () => {
      const tA = tOf(job.cutX), tB = left, th = tB - tA, ra = carrotR(tA), rb = carrotR(tB), rm = Math.max(ra, rb), mid = axisAt((tA + tB) / 2);
      const geo = new THREE.CylinderGeometry(ra, rb, th, 18).rotateZ(Math.PI / 2); // (its length along x: the crown's side at −x)
      const U = geo.attributes.uv;
      for (let i = 0; i < 38; i++) U.setY(i, (tB - U.getY(i) * th) / CARROT.len); // (its rind: that piece of the carrot's skin)
      const m = new THREE.Mesh(geo, [skinMat, cutMat, cutMat]);
      m.position.set(-th / 2, rm, 0);
      m.castShadow = m.receiveShadow = true;
      const s = new THREE.Group(); // (turned about the bottom of its far face: what it tips over on)
      s.rotation.order = 'YXZ';
      s.userData.live = true;
      s.add(m);
      const x0 = job.cutX + th, y0 = Math.max(TH, mid.y - rm), tip = th > 1.4 * rm;
      // where it comes to lie: the blade pushes it off some way along the board, a little to one side or the other, and
      // it comes to rest on whatever is under its middle — the board, or the ones there, sloping as they make it (the
      // lowest of a few such places: pushed off, a slice slides off a heap rather than staying on top of it)
      const corners = (px, py, a) => [[0, 0], [-th, 0], [-th, 2 * rm], [0, 2 * rm]].map(([u, w]) => [px + u * Math.cos(a) + w * Math.sin(a), py - u * Math.sin(a) + w * Math.cos(a)]);
      const land = (xn, z) => {
        const near = slices.filter((o) => Math.abs(o.userData.z - z) < rm + o.userData.r); // (any it could touch, side by side)
        const topAt = (x) => near.reduce((h, o) => {
          const p = o.userData.side;
          for (let k = 0; k < 4; k++) {
            const [ax, ay] = p[k], [bx, by] = p[(k + 1) % 4];
            if ((x - ax) * (x - bx) <= 0 && ax !== bx) h = Math.max(h, ay + ((x - ax) / (bx - ax)) * (by - ay));
          }
          return h;
        }, TH);
        if (tip) { const y = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((k) => topAt(xn - th * k))); return { xn, z, yn: y, to: tilt, top: y + 2 * rm }; }
        // (what it rests on: the upper hull of what is under it, the stretch of it under its middle)
        const pts = Array.from({ length: 13 }, (_, k) => [xn + (2 * rm * k) / 12, topAt(xn + (2 * rm * k) / 12)]), hull = [];
        for (const q of pts) {
          while (hull.length > 1) { const [a, b] = hull.slice(-2); if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0) hull.pop(); else break; }
          hull.push(q);
        }
        let k = 1;
        while (k < hull.length - 1 && hull[k][0] < xn + rm) k++;
        const [a, b] = [hull[k - 1], hull[k]], slope = Math.atan2(b[1] - a[1], b[0] - a[0]), yn = a[1] + (xn - a[0]) * Math.tan(slope);
        return { xn, z, yn, to: Math.PI / 2 - slope, top: Math.max(...corners(xn, yn, Math.PI / 2 - slope).map(([, y]) => y)) };
      };
      // (on the board near the knife where there is room, else a little further off: never up on a heap — they had built
      // a leaning tower, hanging in the air: user, 2026-10-25 — nor on a slope it would slide down; nor by the knife)
      // (and, the board filling up, anywhere on its free end rather than leaning up on the last ones: shingled one on
      // another, each a few millimetres up, they had climbed into a ramp 3.5 cm high)
      let at = null, best = Infinity;
      for (let i = 0; i < 28; i++) {
        const near = i < 10, xn = x0 + Math.min(tip ? 0.022 + r() * 0.012 : 0.004 + r() * (near ? 0.03 : 0.2), Math.max(0, 0.195 - 2 * rm - x0));
        const z = THREE.MathUtils.clamp(mid.z + (r() - 0.5) * (near ? 0.03 : 0.07), 0.05 + rm, 0.132 - rm), c = land(xn, z);
        const score = c.top + 0.08 * (xn - x0) + (Math.abs(Math.PI / 2 - c.to) > 0.45 && !tip ? 1 : 0) + (c.yn > TH + 0.006 ? 0.3 : 0) + (c.top > TH + 0.016 ? 0.05 : 0);
        if (score < best) { best = score; at = c; }
      }
      s.position.set(x0, y0, mid.z);
      s.rotation.z = -tilt;
      s.userData.r = rm;
      s.userData.z = at.z;
      s.userData.side = corners(at.xn, at.yn, at.to);
      s.userData.fall = { t: 0, x0, y0, z0: mid.z, xn: at.xn, yn: at.yn, zn: at.z, from: tilt, to: at.to, spin: (r() - 0.5) * 0.24 };
      B.add(s);
      slices.push(s);
      left = tA;
      fresh = false;
      shape();
      ctx.sound.sample('knife-chop', onBoard(job.cutX, TH, CARROT.z));
    };
    /** The slices still falling, a frame on: pushed off (0.16 s), over (faster and faster) onto where it lies, a rock as they settle. */
    const falling = (dt) => {
      for (const s of slices) {
        const f = s.userData.fall;
        if (!f) continue;
        const t = (f.t += dt), fall = 0.32 * Math.sqrt(Math.abs(f.to - f.from) / (Math.PI / 2) + 0.05);
        const p = mj(t / 0.16), u = THREE.MathUtils.clamp((t - 0.16) / fall, 0, 1), v = THREE.MathUtils.clamp((t - 0.16 - fall) / 0.2, 0, 1);
        s.position.set(THREE.MathUtils.lerp(f.x0, f.xn, Math.max(p * 0.6, u * u)), THREE.MathUtils.lerp(f.y0, f.yn, u * u), THREE.MathUtils.lerp(f.z0, f.zn, Math.max(p * 0.3, u)));
        s.rotation.z = -(f.from + (f.to - f.from) * u * u - 0.07 * Math.sin(Math.PI * v) * (1 - v));
        s.rotation.y = f.spin * mj(v);
        if (v >= 1) delete s.userData.fall;
      }
    };
    /** How high over the carrot the knife clears it at `x` along the board. */
    const over = (x) => { const t = tOf(x); return axisAt(t).y - TH + carrotR(t) + 0.003; };
    /** The next cut: how long it takes (the first slow and careful, then into a rhythm, never two alike) and how high she lifts the knife after it. */
    const nextCut = () => {
      job.H0 = job.H;
      job.P = THREE.MathUtils.lerp(ERRAND.chop[0], ERRAND.chop[1], Math.min(1, job.done / 3)) * (1 + (r() - 0.5) * 0.16);
      job.H = over(job.cutX - ERRAND.slice) + 0.011 + r() * 0.012;
    };
    /** Her hands at the board, each frame, over her pose: the knife taken up, the cuts, put down again. */
    const work = (dt) => {
      const t = (job.t += dt), rest = knifeAtHome();
      let kn = null, right = null; // (where the knife is to be, if her hand has it; else where her hand is to be)
      if (job.phase === 'reach') {
        // out to the knife where it lies as she comes up to it, down onto its handle from above, half closing round it;
        // she takes it up once she has stopped
        job.wR = mj(t / 0.95);
        job.fist = 0.35 * mj((t - 0.6) / 0.4); // (half closed: her fingers can't go round it as it lies on the board)
        right = handOn(rest.p, rest.q);
        right.wrist.addScaledVector(upw, 0.07 * (1 - mj((t - 0.2) / 0.8)));
        if (t >= 1 && state === 'work') {
          job.phase = 'lift';
          job.t = 0;
          job.held = true;
          job.H = over(job.cutX) + 0.03;
        }
      } else if (job.phase === 'lift') { // up off the board, turned to cut, over the carrot's end; the left hand onto the carrot
        const k = mj(t / 0.75), to = cutting(job.knifeX, job.H);
        kn = { p: rest.p.lerp(to.p, k).addScaledVector(upw, 0.035 * Math.sin(Math.PI * k)), q: turnKnife(rest.q, to.q, k) };
        job.wL = mj((t - 0.15) / 0.55);
        job.fist = 0.35 + 0.65 * mj((t - 0.05) / 0.3); // (closed round it as it comes up off the board)
        if (t >= 0.75) { job.phase = 'chop'; job.t = 0; job.cut = false; nextCut(); }
      } else if (job.phase === 'chop') {
        // down onto the carrot, pressed through it pushing the blade on a little, a beat on the board, up again and
        // over to where the next one goes once it is clear of the carrot. Every so often, the knife down, she stops
        // and looks your way (LOOKS)
        if (job.look >= 0) {
          job.t -= dt; // (the cut waits)
          if ((job.look += dt) >= LOOKS.back) { job.look = -1; job.since = 0; }
        } else job.since += dt;
        const k = job.t / job.P, top = over(job.cutX), next = job.cutX - ERRAND.slice;
        let rise, push = 0;
        if (k < 0.28) rise = THREE.MathUtils.lerp(job.H0, top, mj(k / 0.28));
        else if (k < 0.52) { const u = mj((k - 0.28) / 0.24); rise = top * (1 - u); push = 0.018 * u; }
        else if (k < 0.6) { rise = 0; push = 0.018; }
        else { const u = mj((k - 0.6) / 0.4); rise = job.H * u; push = 0.018 * (1 - u); }
        job.knifeX = job.cut ? THREE.MathUtils.lerp(job.cutX, next, mj((rise - top) / Math.max(0.004, job.H - top))) : job.cutX;
        kn = cutting(job.knifeX, rise, push);
        if (k >= 0.52 && !job.cut) { job.cut = true; sliceOff(); }
        if (job.look < 0 && job.cut && k >= 0.52 && k < 0.6 && job.since >= LOOKS.every) job.look = 0;
        if (k >= 1) {
          job.done++;
          job.t = 0;
          job.cut = false;
          job.cutX = job.knifeX = next;
          if (job.done >= job.cuts || job.cutX - CARROT.top < 0.03) { job.phase = 'set'; job.from = { p: knife.getWorldPosition(new V()), q: knife.getWorldQuaternion(new Q()) }; }
          else nextCut();
        }
      } else if (job.phase === 'set') { // the knife back where it was; the left hand off the carrot
        const k = mj(t / 0.85);
        kn = { p: job.from.p.clone().lerp(rest.p, k).addScaledVector(upw, 0.035 * Math.sin(Math.PI * k)), q: turnKnife(job.from.q, rest.q, k, job.from.q) };
        job.wL = 1 - mj(t / 0.45);
        job.fist = 1 - 0.65 * mj((t - 0.55) / 0.3); // (and open again as it comes down onto it)
        if (t >= 0.85) {
          putKnife(rest.p, rest.q);
          kn = null;
          right = handOn(rest.p, rest.q);
          job.held = false;
          ctx.sound.sample('knife-down', rest.p);
          job.phase = 'let';
          job.t = 0;
        }
      } else if (job.phase === 'let') { // letting go of it, the hand back; she is already turning away
        job.fist = 0.35 * (1 - mj(t / 0.3));
        job.wR = 1 - mj((t - 0.1) / 0.5);
        right = handOn(rest.p, rest.q);
        right.wrist.addScaledVector(upw, 0.05 * mj(t / 0.6));
        if (t >= 0.3 && state === 'work') state = 'leave';
        if (t >= 0.6) { job.phase = 'off'; job.t = 0; job.wR = job.fist = 0; }
      } else if (job.phase === 'off') {
        // her hands up off the worktop and back to her as she turns, and then let go of to swing as she walks (let go
        // of where they lay, they dropped through it)
        job.lift = mj(t / 0.45);
        if (t >= 0.85) { job.phase = ''; job.wR = job.wL = job.fist = job.lift = 0; }
      }
      if (kn) right = handOn(kn.p, kn.q);
      // each hand between resting on the worktop (as at the board, whatever her lean: else leaning in pressed them into
      // it) and what it is doing, as far as `wL`, `wR`
      const lt = lie('Left', { along: intoB.clone().multiplyScalar(Math.cos(0.5)).addScaledVector(upw, -Math.sin(0.5)), palm: upw.clone().negate() }), hx = job.knifeX - 0.09; // (its fingers clear of the blade — at 5 cm one went through it — and back towards her along the carrot, in reach)
      const tasks = { Left: [job.wL, wristFor(onBoard(hx, axisAt(tOf(hx)).y + carrotR(tOf(hx)) + 0.015, axisAt(tOf(hx)).z), lt, hands.Left.mid), lt.q], Right: [job.wR, right?.wrist, right?.q] };
      for (const side of ['Left', 'Right']) {
        const [w, wrist, q] = tasks[side], rest = onTop(side, job.lift), W = Math.max(w, job.phase === 'reach' ? wBent : job.phase === 'off' ? 1 - mj((job.t - 0.3) / 0.55) : 1);
        if (W <= 0) continue;
        const tw = w > 0 ? rest.wrist.lerp(wrist, w) : rest.wrist, tq = w > 0 ? rest.q.slerp(q, w) : rest.q;
        // (her elbow in line behind the knife only as she cuts with it; taking it up and putting it down, out at her side)
        const inLine = side === 'Right' ? w * ({ lift: mj(job.t / 0.75), chop: 1, set: 1 - mj(job.t / 0.5) }[job.phase] ?? 0) : 0;
        blendArm(side, W, tw, tq, inLine > 0 ? pole(side).lerp(elbowFor(side, tw, tq), inLine) : pole(side));
      }
      if (job.held) { // the knife where her hand has it
        const h = bones.RightHand, k = knifeIn(h.getWorldPosition(new V()), h.getWorldQuaternion(new Q()));
        putKnife(k.p, k.q);
      }
      // (how far closed, as the two stages either side of it)
      const k = job.fist * FIST_STAGES.length, at = Math.min(Math.floor(k), FIST_STAGES.length - 1);
      body.morphTargetInfluences.fill(0);
      if (at > 0) body.morphTargetInfluences[at - 1] = at + 1 - k;
      body.morphTargetInfluences[at] = k - at;
    };
    /** How far she leans in over and above the pose at the board: reaching out, taking the knife up, putting it back. */
    const leaning = () => ({ reach: 0.07 * Math.sin(Math.PI * Math.min(1, job.t / 1.1)), lift: 0.07, chop: job.look >= 0 ? -0.01 : 0.09, set: 0.05, let: 0.02 })[job.phase] ?? 0; // (looking up from the board, she straightens a little)

    let shadowOld = false;
    ctx.animated.push((time, dt) => {
      if (dt <= 0) return;
      const [walkTo, bentTo] = step(dt);
      blend(dt, walkTo, bentTo);
      her.rotation.y = heading;
      framed();
      her.updateMatrixWorld(true);
      lean = ease(lean, leaning(), leanV, 0.25, 1, dt);
      if (Math.abs(lean) > 1e-4) turn(bones.Spine, lean, 0, 0);
      // her steps on the floor, as each foot comes down (if there is a recording of them)
      if (stride > 0 && wWalk > 0.5) for (const c of [0.35, 0.85]) if ((walkT - stride + 1) % 1 < c && walkT >= c) ctx.sound.sample('step-tile', her.position.clone().setY(0.02), 0.6);
      // where she looks: at you, standing; where she is going, walking; the knife as she comes up to it; what her hands do
      const going = state === 'toBoard' || state === 'toHome', rest = way.len - way.s;
      const looking = job.phase === 'chop' && job.look >= 0;
      const task = state === 'stand' || state === 'settle' || halted > 0.3 || (state === 'toHome' && rest < 0.7) ? null
        : looking && job.look < LOOKS.at ? ctx.camera.position.clone()
        : state === 'toHome' ? onWay(way.s + 1.5).setY(0.95) // (her head first round the way she turns)
        : state === 'leave' ? home.clone().addScaledVector(homeWay, -0.5).setY(0.95)
        : job.phase === 'reach' || (state === 'toBoard' && rest < 1.8) ? knife.getWorldPosition(new V())
        : job.phase ? onBoard(job.knifeX - 0.01, TH, CARROT.z)
        : going ? onWay(way.s + 1.5).setY(0.95) : 'ahead';
      const b = breath(dt), h = lookStep(time, dt, task, looking ? (job.look < LOOKS.at ? 'snap' : 'slow') : '');
      for (const [n, [p, y, w]] of Object.entries(SHARE)) turn(bones[n], h.pitch * p, h.yaw * y, REST.roll * w);
      breathing.value = b;
      // the shoulders, and so the arms, carried up and out by it (her frame → the chest bone's)
      for (const bone of shoulders) {
        bone.parent.updateWorldMatrix(true, false);
        dl.copy(lift).multiplyScalar(b).applyQuaternion(frame).applyMatrix3(m3.setFromMatrix4(bone.parent.matrixWorld).invert());
        bone.position.add(dl);
      }
      // (her hands at work last, from where all that leaves her shoulders: else the knife and her hand come apart)
      if (job.phase) work(dt);
      falling(dt);
      // her eyes: on you while she watches you, else on what her head is turned to, or ahead of her; and while she
      // cuts, now and then up at you
      eyesStep(dt, glanceUp(dt, job.phase === 'chop' && !looking) || (task === null && watching) ? ctx.camera.position : task === null || task === 'ahead' ? null : task);
      // what she takes up of the floor goes with her; the kitchen lamp's shadow of her drawn again as she moves, every
      // frame — while you are near enough to see it. (Every third frame, as it was, she was shaded two frames in three
      // by herself as she had been a moment before, a few centimetres back: the light on her flickered as she walked
      // — user, 2026-10-28. Drawn each frame it costs under half a millisecond.)
      if (state !== 'stand') {
        footprint(her.position.x, her.position.z, heading);
        shadowOld = true;
      }
      if (shadowOld && ctx.camera.position.distanceTo(her.position) < 9) { moved(); shadowOld = state !== 'stand'; }
    });
    her.userData.mum = { go: () => { met = true; clock = 0; }, get state() { return state; }, get met() { return met; }, get clock() { return clock; }, job, weight, way, gaze, blink, lid }; // (to look at her errand by hand)
    return her;
  });
}
