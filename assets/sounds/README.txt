SOUNDS FOR THE ROOM
===================

Drop recordings in this folder and the game picks them up by file name — no code changes.
Anything missing is simply silent.

Formats: .ogg .mp3 .wav .m4a .flac
One take:      door-open.ogg
Several takes: step-carpet-1.ogg, step-carpet-2.ogg, step-carpet-3.ogg ...
               (picked at random, never the same one twice in a row)

Trim each file tight: no silence before the sound starts, one event per file.
Level doesn't matter much — every file is brought to the same loudness when it loads —
but a very quiet recording will have its hiss turned up along with it.


NEEDED  (silent until a recording is here — the game makes NO sound of its own)
--------------------------------------------------------------------------------
IN NOW:  pigeon  (the only recording kept: the user's own coo, cleaned)

room-tone       the standing sound of a quiet room, 20-60 s that loops cleanly: the base everything
                 else sits on. Played all the time, quietly, everywhere in the game.

bird            one short chirp or phrase from a single bird, 4-8 takes
pigeon          one cooing phrase, 2-4 takes
                (both are played rarely, quietly and muffled, as if through closed glass —
                 use clean, close recordings; the game does the muffling)

step-carpet     ONE soft footstep on carpet per file: -1 then -2 (left foot, right foot)
step-bed        one step on a mattress / duvet per file, -1 then -2
step-wood       one step on a wooden surface per file, -1 then -2
step-tile       one step on tiles (bathroom, kitchen vinyl) per file, -1 then -2
step-grass      one step on a lawn per file, -1 then -2
                (steps are the exception to "picked at random": they play in file order,
                 and every new walk starts again from -1; a tiny shuffle is one step only)
land-carpet     landing from a small jump on carpet, 1-2 takes
land-bed        landing on a mattress (springs welcome), 1-2 takes
land-wood       landing on a wooden surface, 1-2 takes
land-tile       landing on tiles, 1-2 takes
land-grass      landing on grass, 1-2 takes
step-water      one step in a few millimetres of water on tiles, -1 then -2 (the flooded bathroom;
                 until there is one, the tiles' step plays)
land-water      landing in shallow water on tiles, 1-2 takes

cat-meow        a single meow, 3-5 takes (she meows rarely)
cat-purr        3-6 seconds of purring (played when you pet her)
cat-lick        one lick, very quiet, 1-3 takes (optional)
cat-land        a cat jumping down onto carpet (optional)

tap-turn        an old cross-head bath tap being turned, on or off (about 0.5 s), 1-3 takes
bath-run        a bath tap running into a bath, steady, 10-30 s that loops cleanly (played
                 round and round while a tap is on)
bath-spill      water running over the edge of a bath onto a tiled floor, steady, loops cleanly
toilet-lid      a plastic toilet lid being lifted or put down, 1-3 takes
hose-run        water running out of a garden hose's spray nozzle onto grass, steady (a loop of 4-8 s)
sand-dig        a child's plastic spade pushed into damp sand and a spadeful thrown aside (about 0.6 s), 2-4 takes
slide           a child going down an old steel slide in jeans, from sitting down to landing in sand (about 2 s)
toilet-flush    a toilet flushed with the button on its cistern: the rush, the gurgle, the cistern refilling (one take, 6-8 s)
basin-tap       a single-lever basin mixer lifted or pushed down, 1-3 takes
basin-run       a basin tap running into the bowl and away down the plug hole, steady, loops cleanly

cellar-rattle   two heavy old steel cellar doors (the slanted kind, outdoors) tugged up against their padlock and
                 dropped back: sheet steel banging on concrete, the hasp and padlock clattering (about 0.8 s), 2-3 takes
cellar-give     the same, harder, and the rusted steel round the lock's staple tearing out with a screech (about 1 s)
cellar-open     the two doors swung right open and dropped back against their stops: creak, then a heavy thud (2-3 s)
step-concrete   one step on a dusty concrete floor / concrete stairs, -1 then -2
land-concrete   landing on concrete, 1-2 takes
door-locked     a locked door's knob tried: the knob turned, the latch held, a small rattle
chain-pull      a light's pull chain tugged: a click, the chain swinging (and no light)

door-open       interior door: latch, then the swing (about 1 s)
door-close      interior door: swing, then the latch
door-slam       the bathroom door flung shut: a hard bang on the frame, a little rattle after (1-2 takes)
cabinet-open    a small old steel wall cabinet's door opened: a squeak of the hinge, the catch
cabinet-close   the same door shut: a thin metal clack
cooker-on       a gas ring being lit: the knob's click, the tick of the igniter, the flame catching
cooker-off      the knob turned back, the flame going out
fridge-open     an old fridge's door pulled open: the seal letting go, the hum louder
fridge-close    the door pushed shut: a soft thud, the seal catching, bottles in the door clinking
clock-tick      an old longcase clock's escapement: -1 the tick, -2 the tock (played in turn, once a second)
knife-chop      a kitchen knife through a carrot onto a wooden chopping board: one cut (several takes welcome)
knife-down      the knife put down flat on the wooden board
switch          a light switch click (the bathroom's, and the bedroom's)
blinds          venetian blind slats being tilted (about 0.5 s)
chair-sit       sitting down on a swivel office chair
chair-stand     getting up from it
bag-open        a backpack zip pulled open in one go, about a second long
bag-spill       the front of a canvas backpack flopping onto carpet, a notebook and pencil case sliding out, pencils scattering
take            a small thing (a pencil, scissors, a torch) picked up off carpet, very short, 2-3 takes

THE ELECTRONICS  (the PC, the TV and the desktop's own sounds; also silent until a recording is here)
tv-on, tv-off   CRT television switching on / off
tv-static       the hiss of a CRT tuned to nothing (snow), steady, loops cleanly
pc-on, pc-off   desktop PC power button + fan and disk spinning up / down
pc-seek         hard disk chatter, short, 2-4 takes
pc-floppy       floppy drive seek at boot
key             one keyboard key, 3-5 takes
mouse-click     one mouse click
pc-chime        the desktop's start-up sound          pc-bye   its shut-down sound
pc-open         a window opening                      pc-beep  a system beep
pc-boom, pc-win, pc-tick   the desktop's little games / alerts


LICENCE
-------
The game is meant to be sold: only use recordings whose licence allows commercial use
(CC0 / public domain is the simplest). Keep a note of where each file came from.


LIST.JSON
---------
list.json in this folder names the recordings for the published site (a web host can't list a
folder). The local server rewrites it every time the game loads, so after adding or removing a
recording just open the game once locally before uploading.
